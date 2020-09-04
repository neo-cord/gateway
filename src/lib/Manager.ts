/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { Emitter, mergeObjects, sleep, Collection } from "@neocord/utils";
import { make } from "rikuesuto";
import { API, DEFAULTS, GatewayCloseCode, ISMEvent, ShardEvent, USER_AGENT } from "../constants";
import { InternalShard } from "./InternalShard";

import type { CompressionType } from "./compression";
import type WebSocket from "ws";

const unrecoverable = Object.values(GatewayCloseCode).slice(1);
const un_resumable = [
  1000,
  4006,
  GatewayCloseCode.InvalidSeq
];

/**
 * Handles internalized bot sharding.
 */
export class InternalShardingManager extends Emitter {
  /**
   * All shards currently being managed by the ISM.
   */
  public readonly shards: Collection<number, InternalShard>;

  /**
   * The compression to use.
   */
  public compression: CompressionType | false;

  /**
   * Whether or not the ISM is ready.
   */
  public ready: boolean;

  /**
   * The type of serialization.
   */
  public useEtf: boolean;

  /**
   * The options provided to this ISM instance.
   */
  public options: Required<ISMOptions>;

  /**
   * Whether or not this internal sharding manager is destroyed.
   */
  public destroyed: boolean;

  /**
   * Whether or not this manager is reconnecting.
   */
  public reconnecting: boolean;

  /**
   * The gateway address.
   */
  public gatewayUrl!: string;

  /**
   * The total shards.
   * @private
   */
  private _shards!: number;

  /**
   * The shard connect queue.
   * @private
   */
  private _queue!: Set<InternalShard>;

  /**
   * The session start limit.
   * @private
   */
  private _limit!: SessionStartLimit;

  /**
   * Creates a new InternalShardingManager.
   * @param options
   */
  public constructor(options: ISMOptions = {}) {
    options = mergeObjects(options, DEFAULTS);
    super();

    this.shards = new Collection();
    this.destroyed = this.reconnecting = this.ready = false;
    this.options = options as Required<ISMOptions>;
    this.useEtf = options.useEtf ?? false;
    this.compression = options.compression === true
      ? "zlib"
      : options.compression ?? false;
  }

  /**
   * The token to use when connecting shards.
   * @private
   */
  private _token!: string;

  /**
   * The bot token.
   */
  public get token(): string {
    return this._token;
  }

  /**
   * Set the token to use.
   * @param token The discord bot token.
   */
  public set token(token: string) {
    Object.defineProperty(this, "token", {
      value: token
    });
  }

  /**
   * Destroys this manager.
   */
  public destroy(): void {
    if (!this.destroyed) return;

    this._debug(`Destroying... Called by:\n${new Error("Manager Destroyed.").stack}`);
    this._queue.clear();
    this.destroyed = true;

    for (const [ , shard ] of this.shards) {
      shard.destroy({
        reset: true,
        emit: false,
        log: false,
        code: 1000
      });
    }
  }

  /**
   * Connects all shards.
   */
  public async connect(): Promise<void> {
    // (0) Fetch Session Info
    const {
      url,
      shards: shardCount,
      session_start_limit: startLimit
    } = await this._fetchSession();

    const { remaining, reset_after, total } = startLimit;
    this._debug(`Fetched Gateway Info: URL = ${url}, Shards = ${shardCount}`);
    this._debug(`Session Limit Info: Total = ${total}, Remaining = ${remaining}`);
    this._setGateway(url);

    // (1) Configure Sharding Options.
    let shards: number[] = [];
    if (Array.isArray(this.options.shards)) {
      if (!this.options.shardCount)
        throw new Error("\"shardCount\" must be supplied if you are defining \"shards\" with an array.");

      shards.push(...this.options.shards.filter(s => !Number.isNaN(s)));
    } else if (this.options.shards === "auto") {
      this.options.shardCount = shardCount;
      shards = Array.from({ length: shardCount }, (_, i) => i);
    } else {
      this.options.shards = this.options.shardCount as number;
      shards = Array.from({ length: this.options.shards }, (_, i) => i);
    }

    this._debug(`Spawning Shards: ${shards}`);

    // (2) Finalize
    this._limit = startLimit;
    this._shards = shards.length;
    this._queue = new Set(shards.map(id => new InternalShard(this, id)));

    // (3) Handle the start limit and start a shard.
    await this._handleLimit(remaining, reset_after);
    await this._spawn();
  }

  /**
   * Handles the session start limit for internalized sharding.
   * @private
   */
  private async _handleLimit(remaining?: number, resetAfter?: number) {
    if (typeof remaining === "undefined" && typeof resetAfter === "undefined") {
      const { session_start_limit } = await this._fetchSession();

      this._limit = session_start_limit;
      remaining = session_start_limit.remaining;
      resetAfter = session_start_limit.reset_after;

      this._debug(`Session Limit Info: Total = ${this._limit.total}, Remaining = ${this._limit.remaining}`);
    }

    if (!remaining) {
      this._debug(`Exceeded identify threshold. Attempting a connecting in ${resetAfter}ms`);
      await sleep(resetAfter as number);
    }
  }

  /**
   * Spawns a single shard.
   * @private
   */
  private async _spawn(): Promise<boolean> {
    if (!this._queue.size) return true;

    const [ shard ] = this._queue;
    this._queue.delete(shard);
    this._shards.toLocaleString();

    if (!shard.managed) {
      shard
        .on(ShardEvent.FullReady, (guilds: Set<string>) => {
          this.emit(ISMEvent.ShardReady, shard, guilds);
          if (!this._queue.size) this.reconnecting = false;
          this._checkShards();
        })
        .on(ShardEvent.Close, (event: WebSocket.CloseEvent) => {
          if (event.code === 1000 ? this.destroyed : unrecoverable.includes(event.code)) {
            this.emit(ISMEvent.ShardError, shard, event);
            this._debug(`Close Reason: ${GatewayCloseCode[event.code]}`, shard.id);
            return;
          }

          if (un_resumable.includes(event.code))
            shard.session.reset();

          this.emit(ISMEvent.ShardReconnecting, shard);
          this._queue.add(shard);

          if (shard.session.id) {
            this._debug("session id is present, attempting to reconnect.", shard.id);
            this._reconnect(true);
          } else {
            shard.destroy({ reset: true, emit: false, log: false });
            this._reconnect();
          }
        })
        .on(ShardEvent.InvalidSession, () => this.emit(ISMEvent.ShardReconnecting, shard))
        .on(ShardEvent.Destroyed, () => {
          this._debug("Destroyed, but no connection was present. Reconnecting", shard.id);

          this.emit(ISMEvent.ShardReconnecting, shard);
          this._queue.add(shard);
          this._reconnect();
        });

      shard.managed = true;
    }

    this.shards.set(shard.id, shard);

    try {
      shard.connect();
    } catch (e) {
      if (e && e.code && unrecoverable.includes(e.code)) throw new Error(GatewayCloseCode[e.code]);
      else if (!e || e.code) {
        this._debug("Failed to connect, re-queueing...", shard.id);
        this._queue.add(shard);
      } else throw e;
    }

    if (this._queue.size) {
      this._debug(`Queue Size: ${this._queue.size}, connecting the next shard in 5 seconds.`);

      await sleep(5000);
      await this._handleLimit();
      await this._spawn();
    }

    return true;
  }

  /**
   * Reconnects all queued shards.
   * @private
   */
  private async _reconnect(skipLimit = false): Promise<boolean> {
    if (this.reconnecting) return false;

    this.reconnecting = true;
    try {
      if (!skipLimit) await this._handleLimit();
      await this._spawn();
    } catch (e) {
      this._debug(`Couldn't reconnect or fetch information about the gateway. ${e}`);
      if (e.httpStatus !== 401) {
        this._debug("Possible network error occurred. Retrying in 5 seconds.");

        await sleep(5000);
        this.reconnecting = false;
        return this._reconnect(skipLimit);
      }

      this.emit(ISMEvent.Invalidated);
      this.destroy();
    } finally {
      this.reconnecting = false;
    }

    return true;
  }

  /**
   * Checks if all shards are connected.
   * @private
   */
  private _checkShards() {
    if (this.ready) return;
    if (this.shards.size !== this._shards) return;

    this.ready = true;
    this.emit(ISMEvent.Ready);
  }

  /**
   * @private
   */
  private _debug(message: string, shard?: number) {
    this.emit(ISMEvent.Debug, `(${shard ? `Shard ${shard}` : "Manager"}) ${message.trim()}`);
  }

  /**
   * @private
   */
  private _setGateway(url: string): void {
    if (this.options.url !== "auto") {
      if (this.options.url) {
        this.gatewayUrl = this.options.url;
        return;
      }
    }

    this.gatewayUrl = url;
  }

  /**
   * @private
   */
  private async _fetchSession(): Promise<SessionInfo> {
    const res = await make<SessionInfo>(`${API}/gateway/bot`, {
      headers: {
        "user-agent": USER_AGENT,
        authorization: `Bot ${this.token.replace(/^Bot\s*/, "")}`
      }
    });

    return res.json as SessionInfo;
  }
}

export interface ISMOptions {
  shards?: number | number[] | "auto";
  shardCount?: number | null;

  /**
   * The type of zlib compression to use, if you even want it.
   */
  compression?: CompressionType | boolean;

  /**
   * Whether or not to use etf encoding. Must have "erlpack" installed.
   */
  useEtf?: boolean;

  /**
   * The intents to use.
   */
  intents?: number;

  /**
   * Set a custom gateway url. Defaults to "auto".
   */
  url?: "auto" | string;

  /**
   * The gateway version to use.
   */
  version?: number;

  /**
   * The device properties.
   */
  properties?: {
    $device: string;
    $browser: string;
    $os: string;
  }
}

export interface SessionInfo {
  url: string;
  shards: number;
  session_start_limit: SessionStartLimit
}

export interface SessionStartLimit {
  total: number;
  remaining: number;
  reset_after: number;
}
