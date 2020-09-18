/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { Bucket, define, Emitter, Timers } from "@neocord/utils";
import WebSocket from "ws";
import { URLSearchParams } from "url";
import { GatewayEvent, GatewayOpCode, ISMEvent, Payload, ShardEvent, Status } from "../constants";
import { Heartbeat, Session } from "./connection";
import { Compression } from "./compression";
import { RawData, Serialization } from "./serialization";

import type { ShardManager } from "./Manager";

const connectionStates = Object.keys(WebSocket);

export class Shard extends Emitter {
  /**
   * The internal sharding manager.
   */
  public readonly manager: ShardManager;

  /**
   * The ID of this shard.
   */
  public readonly id: number;

  /**
   * This shard's heartbeat handler..
   */
  public readonly heartbeat: Heartbeat;

  /**
   * This shard's session handler.
   */
  public readonly session: Session;

  /**
   * The status of this shard..
   */
  public status: Status;

  /**
   * When this shard connected to the gateway.
   */
  public connectedAt!: number;

  /**
   * Whether or not this shard is managed by the internal sharding manager.
   */
  public managed = false;

  /**
   * Guilds that are expected to be received.
   */
  public expectingGuilds?: Set<string>;

  /**
   * The serialization handler.
   * @private
   */
  private _serialization!: Serialization

  /**
   * The compression handler.
   * @private
   */
  private _compression?: Compression;

  /**
   * The rate-limit bucket.
   * @private
   */
  private _bucket!: Bucket

  /**
   * The websocket instance.
   * @private
   */
  private _ws?: WebSocket;

  /**
   * The ready timeout.
   * @private
   */
  private _readyTimeout?: NodeJS.Timeout;

  /**
   * The shard sequence when the websocket closes.
   * @private
   */
  private _closingSeq!: number;

  /**
   * The current sequence.
   * @private
   */
  private _seq!: number;

  /**
   * The payloads that are waiting to be sent.
   * @private
   */
  private readonly _queue!: Payload[];

  /**
   * Creates a new InternalShard instance.
   * @param manager The ISM instance.
   * @param id The ID of this shard.
   */
  public constructor(manager: ShardManager, id: number) {
    super();

    this.manager = manager;
    this.id = id;
    this.status = Status.Idle;

    const writable = [ "_seq", "_closingSeq", "_bucket", "_compression", "_serialization", "_queue", "_ws" ];
    for (const key of writable) define({ writable: true })(this, key);

    this._seq = -1;
    this._closingSeq = 0;
    this._bucket = new Bucket(120, 60);
    this._queue = [];

    this.heartbeat = new Heartbeat(this);
    this.session = new Session(this);
  }

  /**
   * The current sequence.
   */
  public get sequence(): number {
    return this._seq;
  }

  /**
   * The sequence when the socket closed.
   */
  public get closingSequence(): number {
    return this._closingSeq;
  }

  /**
   * The latency of this shard.
   */
  public get latency(): number {
    return this.heartbeat.latency;
  }

  /**
   * Whether or not this shard is connected.
   */
  public get connected(): boolean {
    return this.status === Status.Ready
      || (!!this._ws
        && this._ws.readyState === WebSocket.OPEN);
  }

  /**
   * Send a new payload to the gateway.
   * @param data The payload to send.
   * @param prioritized Whether or not to prioritize this payload.
   */
  public send(data: Payload, prioritized = false): void {
    if (this.connected) {
      const func = () => this._ws?.send(this._serialization.encode(data));
      this._bucket.queue(func, prioritized);
      return;
    }

    this._queue[prioritized ? "unshift" : "push"](data);
  }

  /**
   * Destroys the websocket connection.
   */
  public destroy(options: DestroyOptions = {
    code: 1000,
    emit: true,
    log: true,
    reset: false
  }): void {
    if (options.log)
      this._debug(`Destroying... Code: ${options.code}, Resetting?: ${options.reset}`);

    // (0) Reset the heartbeat.
    this.heartbeat.reset();

    // (1) Close the WebSocket.
    if (this._ws) {
      if (this._ws.readyState === WebSocket.OPEN) this._ws.close();
      else {
        this._debug(`WebSocket State: ${connectionStates[this._ws.readyState]}`);

        try {
          this._ws.close();
        } catch {
          // no-op
        }

        if (options.emit) this.emit(ShardEvent.Destroyed);
      }
    } else if (options.emit) this.emit(ShardEvent.Destroyed);

    // (2) Reset some shit.
    delete this._ws;
    this.status = Status.Disconnected;

    if (this._seq !== -1) this._closingSeq = this._seq;
    if (options.reset) this.session.reset();

    this._bucket = new Bucket(120, 6e4);
  }

  /**
   * Connects to the discord gateway.
   */
  public connect(): void {
    // (0) Check if a connection already exists. If so identify the session.
    if (this.connected) {
      this._debug("A connection is already present, attempting to identify.");
      this.session.identify();
      return;
    }

    // (1) If a socket is already defined, destroy it.
    if (this._ws) {
      this._debug("A connection is already present, cleaning up before reconnecting.");
      this.destroy();
    }

    // (3) Setup serialization and compression.
    const q = new URLSearchParams();
    const encoding = this.manager.useEtf ? "etf" : "json";
    q.append("encoding", encoding);

    this._serialization = Serialization.create(encoding);
    if (this.manager.compression) {
      this._compression = Compression.create(this.manager.compression)
        .on("data", buffer => this._packet(buffer))
        .on("error", (e) => this._debug(`Compression Error: ${e.message}`))
        .on("debug", (message) => this._debug(message));

      q.append("compress", "zlib-stream");
    }

    // (4) Set the status and wait for the hello op code.
    this.status = this.status === Status.Disconnected ? Status.Reconnecting : Status.Connecting;
    this.connectedAt = Date.now();
    this.session.waitForHello();

    // (5) Define the WebSocket.
    const uri = this.manager.gatewayUrl.endsWith("/")
      ? this.manager.gatewayUrl
      : `${this.manager.gatewayUrl}/`;

    this._ws = new WebSocket(`${uri}?${q}`);
    this._ws.onopen = this._open.bind(this);
    this._ws.onerror = this._error.bind(this);
    this._ws.onclose = this._close.bind(this);
    this._ws.onmessage = this._message.bind(this);
  }

  /**
   * Handles a decompressed packet from discord.
   * @param data The decompressed packet
   * @private
   */
  private _packet(data: RawData) {
    let pk!: Payload<Dictionary>;
    try {
      pk = this._serialization.decode(data) as Payload<Dictionary>;
      this.manager.emit(ISMEvent.RawPacket, pk, this);
    } catch (e) {
      this.emit(ShardEvent.Error, e);
      return;
    }

    switch (pk.t) {
      case GatewayEvent.Ready:
        this.emit(ShardEvent.Ready);

        this.session.id = pk.d?.session_id;
        this.status = Status.WaitingForGuilds;
        this.expectingGuilds = new Set<string>(pk.d?.guilds?.map((g: Dictionary) => g.id));

        this.heartbeat.acked = true;
        this.heartbeat.new("ready");
        break;
      case GatewayEvent.Resumed:
        this.emit(ShardEvent.Resumed);

        this.status = Status.Connected;
        this.heartbeat.acked = true;
        this.heartbeat.new("resume");
        break;
    }


    if (pk.s != null) {
      if (this._seq !== -1 && pk.s > this._seq + 1) this._debug(`Non-consecutive sequence [${this._seq} => ${pk.s}]`);
      this._seq = pk.s;
    }

    switch (pk.op) {
      case GatewayOpCode.Hello:
        this.heartbeat.heartbeatInterval = pk.d?.heartbeat_interval;
        this.session.hello();
        break;
      case GatewayOpCode.Reconnect:
        this._debug("Gateway asked us to reconnect.");
        this.destroy({ code: 4000 });
        break;
      case GatewayOpCode.InvalidSession:
        this._debug(`Invalid Session: Resumable => ${pk.d ?? "None"}`);
        if (pk.d) {
          this.session.resume();
          break;
        }

        this._seq = -1;
        this.session.reset();
        this.emit(ShardEvent.InvalidSession);
        break;
      case GatewayOpCode.Heartbeat:
        this.heartbeat.new("requested", true);
        break;
      case GatewayOpCode.HeartbeatAck:
        this.heartbeat.ack();
        break;
      default:
        if (this.status === Status.WaitingForGuilds && pk.t === GatewayEvent.GuildCreate) {
          this.expectingGuilds?.delete(pk.d?.id);
          this._checkReady();
        }
    }
  }

  /**
   * Checks if there are anymore guilds that supposed to be sent.
   * @private
   */
  private _checkReady(): void | number {
    if (this._readyTimeout) {
      Timers.clearTimeout(this._readyTimeout);
      delete this._readyTimeout;
    }

    if (!this.expectingGuilds?.size) {
      this._debug("Shard has received all guilds. Marking as full-ready.");
      this.status = Status.Ready;
      return this.emit(ShardEvent.FullReady);
    }

    this._readyTimeout = Timers.setTimeout(() => {
      this.status = Status.Ready;
      this._debug("Shard did not receive any more guild packets within 15 seconds.");
      this.emit(ShardEvent.FullReady, this.expectingGuilds);
      delete this._readyTimeout;
    }, 15e3);
  }

  /**
   * Called whenever the websocket opens.
   * @private
   */
  private _open(): void {
    this.status = Status.Nearly;
    this._debug(`Connected. ${this._ws?.url} in ${Date.now() - this.connectedAt}`);

    if (this._queue.length) {
      this._debug(`${this._queue.length} packets waiting... sending all now.`);
      while (this._queue.length > 0) {
        const pk = this._queue.shift();
        if (!pk) break;
        this.send(pk);
      }
    }

    return;
  }

  /**
   * Called whenever the websocket encounters an error.
   * @private
   */
  private _error(event: WebSocket.ErrorEvent): void {
    const error = event && event.error ? event.error : event;
    if (error) this.manager.emit(ISMEvent.ShardError, error, this.id);
    return;
  }

  /**
   * Handles a websocket closed event.
   * @private
   */
  private _close(event: WebSocket.CloseEvent): void {
    this._debug(`[close] code: ${event.code}, clean?: ${event.wasClean ? "yes" : "no"}, reason: ${event.reason ?? "unknown"}`);

    if (this._seq !== -1) this._closingSeq = this._seq;
    this._seq = -1;
    this.status = Status.Disconnected;

    this.heartbeat.reset();
    this.emit(ShardEvent.Close, event);
  }

  /**
   * Handles a websocket message.
   * @private
   */
  private _message(event: WebSocket.MessageEvent): void {
    if (this._compression) this._compression.add(event.data);
    else this._packet(event.data);
  }

  /**
   * Emits a debug message.
   * @private
   */
  private _debug(message: string) {
    return this.manager.emit("debug", `(Shard ${this.id}) ${message.trim()}`);
  }
}

export interface DestroyOptions {
  code?: number;
  reset?: boolean;
  emit?: boolean;
  log?: boolean;
}
