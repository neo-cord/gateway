/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { Bucket, Emitter, Timers } from "@neocord/utils";
import WebSocket from "ws";
import { URLSearchParams } from "url";
import {
  GatewayEvent,
  GatewayOpCode,
  Payload,
  ShardEvent,
  SMEvent,
  Status,
} from "../util/constants";
import { Heartbeat, Session } from "./connection";
import { Compression } from "./compression";
import { RawData, Serialization } from "./serialization";

import type { ShardManager } from "./Manager";

const connectionStates = Object.keys(WebSocket);

export class Shard extends Emitter {
  /**
   * The ID of this shard.
   * @type {number}
   */
  public readonly id: number;

  /**
   * This shard's heartbeat handler.
   * @type {Heartbeat}
   */
  public readonly heartbeat: Heartbeat;

  /**
   * This shard's session handler.
   * @type {Session}
   */
  public readonly session: Session;

  /**
   * The status of this shard.
   * @type {Status}
   */
  public status: Status;

  /**
   * When this shard connected to the gateway.
   * @type {number}
   */
  public connectedAt!: number;

  /**
   * Whether or not this shard is managed by the internal sharding manager.
   * @type {boolean}
   */
  public managed = false;

  /**
   * Guilds that are expected to be received.
   * @type {?Set<string>}
   */
  public expectingGuilds?: Set<string>;

  /**
   * The serialization handler.
   * @type {Serialization}
   * @private
   */
  #serialization!: Serialization;

  /**
   * The compression handler.
   * @type {Compression}
   * @private
   */
  #compression?: Compression;

  /**
   * The rate-limit bucket.
   * @type {Bucket}
   * @private
   */
  #bucket!: Bucket;

  /**
   * The websocket instance.
   * @type {WebSocket}
   * @private
   */
  #ws?: WebSocket;

  /**
   * The shard sequence when the websocket closes.
   * @type {number}
   * @private
   */
  #closingSeq!: number;

  /**
   * The current sequence.
   * @type {number}
   * @private
   */
  #seq!: number;

  /**
   * The payloads that are waiting to be sent.
   * @type {Payload[]}
   * @private
   */
  readonly #queue!: Payload[];

  /**
   * The ready timeout.
   * @type {?NodeJS.Timeout}
   * @private
   */
  private _readyTimeout?: NodeJS.Timeout;

  /**
   * The internal sharding manager.
   * @type {ShardManager}
   */
  readonly #manager: ShardManager;

  /**
   * @param {ShardManager} manager The ISM instance.
   * @param {number} id The ID of this shard.
   */
  public constructor(manager: ShardManager, id: number) {
    super();

    this.#manager = manager;
    this.id = id;
    this.status = Status.Idle;

    this.#seq = -1;
    this.#closingSeq = 0;
    this.#bucket = new Bucket(120, 60);
    this.#queue = [];

    this.heartbeat = new Heartbeat(this);
    this.session = new Session(this);
  }

  /**
   * The shard manager.
   * @type {ShardManager}
   */
  public get manager(): ShardManager {
    return this.#manager;
  }

  /**
   * The current sequence.
   * @type {number}
   */
  public get sequence(): number {
    return this.#seq;
  }

  /**
   * The sequence when the socket closed.
   * @type {number}
   */
  public get closingSequence(): number {
    return this.#closingSeq;
  }

  /**
   * The latency of this shard.
   * @type {number}
   */
  public get latency(): number {
    return this.heartbeat.latency;
  }

  /**
   * Whether or not this shard is connected.
   * @type {boolean}
   */
  public get connected(): boolean {
    return (
      this.status === Status.Ready ||
      (!!this.#ws && this.#ws.readyState === WebSocket.OPEN)
    );
  }

  /**
   * Send a new payload to the gateway.
   * @param {Payload} data The payload to send.
   * @param {boolean} [prioritized] Whether or not to prioritize this payload.
   */
  public send(data: Payload, prioritized = false): void {
    if (this.connected) {
      const func = () => this.#ws?.send(this.#serialization.encode(data));
      this.#bucket.queue(func, prioritized);
      return;
    }

    this.#queue[prioritized ? "unshift" : "push"](data);
  }

  /**
   * Destroys the websocket connection.
   * @param {DestroyOptions} options
   */
  public destroy(
    options: DestroyOptions = {
      code: 1000,
      emit: true,
      log: true,
      reset: false,
    }
  ): void {
    if (options.log)
      this._debug(
        `Destroying... Code: ${options.code}, Resetting?: ${options.reset}`
      );

    // (0) Reset the heartbeat.
    this.heartbeat.reset();

    // (1) Close the WebSocket.
    if (this.#ws) {
      if (this.#ws.readyState === WebSocket.OPEN) this.#ws.close();
      else {
        this._debug(
          `WebSocket State: ${connectionStates[this.#ws.readyState]}`
        );

        try {
          this.#ws.close();
        } catch {
          // no-op
        }

        if (options.emit) this.emit(ShardEvent.Destroyed);
      }
    } else if (options.emit) this.emit(ShardEvent.Destroyed);

    // (2) Reset some shit.
    this.#ws = undefined;
    this.status = Status.Disconnected;

    if (this.#seq !== -1) this.#closingSeq = this.#seq;
    if (options.reset) this.session.reset();

    this.#bucket = new Bucket(120, 6e4);
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
    if (this.#ws) {
      this._debug(
        "A connection is already present, cleaning up before reconnecting."
      );
      this.destroy();
    }

    // (3) Setup serialization and compression.
    const q = new URLSearchParams();
    const encoding = this.#manager.useEtf ? "etf" : "json";
    q.append("encoding", encoding);

    this.#serialization = Serialization.create(encoding);
    if (this.#manager.compression) {
      this.#compression = Compression.create(this.#manager.compression)
        .on("data", (buffer) => this._packet(buffer))
        .on("error", (e) => this._debug(`Compression Error: ${e.message}`))
        .on("debug", (message) => this._debug(message));

      q.append("compress", "zlib-stream");
    }

    // (4) Set the status and wait for the hello op code.
    this.status =
      this.status === Status.Disconnected
        ? Status.Reconnecting
        : Status.Connecting;
    this.connectedAt = Date.now();
    this.session.waitForHello();

    // (5) Define the WebSocket.
    const uri = this.#manager.gatewayUrl.endsWith("/")
      ? this.#manager.gatewayUrl
      : `${this.#manager.gatewayUrl}/`;

    this.#ws = new WebSocket(`${uri}?${q}`);
    this.#ws.onopen = this._open.bind(this);
    this.#ws.onerror = this._error.bind(this);
    this.#ws.onclose = this._close.bind(this);
    this.#ws.onmessage = this._message.bind(this);
  }

  /**
   * Handles a decompressed packet from discord.
   * @param {RawData} data The decompressed packet
   * @private
   */
  private _packet(data: RawData) {
    let pk!: Payload<Dictionary>;
    try {
      pk = this.#serialization.decode(data) as Payload<Dictionary>;
      this.#manager.emit(SMEvent.RawPacket, pk, this);
    } catch (e) {
      this.emit(ShardEvent.Error, e);
      return;
    }

    switch (pk.t) {
      case GatewayEvent.Ready:
        this.emit(ShardEvent.Ready);

        this.session.id = pk.d?.session_id;
        this.status = Status.WaitingForGuilds;
        this.expectingGuilds = new Set<string>(
          pk.d?.guilds?.map((g: Dictionary) => g.id)
        );

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
      if (this.#seq !== -1 && pk.s > this.#seq + 1)
        this._debug(`Non-consecutive sequence [${this.#seq} => ${pk.s}]`);
      this.#seq = pk.s;
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

        this.#seq = -1;
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
        if (
          this.status === Status.WaitingForGuilds &&
          pk.t === GatewayEvent.GuildCreate
        ) {
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
      this._debug(
        "Shard did not receive any more guild packets within 15 seconds."
      );
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
    this._debug(
      `Connected. ${this.#ws?.url} in ${Date.now() - this.connectedAt}`
    );

    if (this.#queue.length) {
      this._debug(`${this.#queue.length} packets waiting... sending all now.`);
      while (this.#queue.length > 0) {
        const pk = this.#queue.shift();
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
    if (error) this.#manager.emit(SMEvent.ShardError, this, error);
    return;
  }

  /**
   * Handles a websocket closed event.
   * @param {WebSocket.CloseEvent} event The close event data.
   * @private
   */
  private _close(event: WebSocket.CloseEvent): void {
    this._debug(
      `[close] code: ${event.code}, clean?: ${
        event.wasClean ? "yes" : "no"
      }, reason: ${event.reason ?? "unknown"}`
    );

    if (this.#seq !== -1) this.#closingSeq = this.#seq;
    this.#seq = -1;
    this.status = Status.Disconnected;

    this.heartbeat.reset();
    this.emit(ShardEvent.Close, event);
  }

  /**
   * Handles a websocket message.
   * @param {WebSocket.MessageEvent} event The message event.
   * @private
   */
  private _message(event: WebSocket.MessageEvent): void {
    return this.#compression
      ? this.#compression.add(event.data)
      : this._packet(event.data);
  }

  /**
   * Emits a debug message.
   * @param {string} message The debug message.
   * @private
   */
  private _debug(message: string) {
    return this.#manager.emit("debug", `(Shard ${this.id}) ${message.trim()}`);
  }
}

export interface DestroyOptions {
  code?: number;
  reset?: boolean;
  emit?: boolean;
  log?: boolean;
}
