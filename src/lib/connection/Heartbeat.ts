/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { GatewayOpCode, Status } from "../../constants";
import { define, Timers } from "@neocord/utils";

import type { Shard } from "../Shard";

/**
 * Handles a shards heartbeat.
 */
export class Heartbeat {
  /**
   * Whether or not our last heartbeat was acknowledged.
   */
  public acked = false;

  /**
   * When we last sent a heartbeat.
   */
  public last = 0;

  /**
   * The heartbeat interval.
   */
  public interval?: number;

  /**
   * The shard this heartbeat belongs to.
   */
  public shard: Shard;

  /**
   * The heartbeat latency.
   */
  public latency = 0;

  /**
   * The node.js interval.
   * @private
   */
  private _interval?: NodeJS.Timeout;

  /**
   * @param shard
   */
  public constructor(shard: Shard) {
    this.shard = shard;
    define({ writable: true })(this, "_interval");
  }

  /**
   * Sets the heartbeat interval.
   * @param ms
   */
  public set heartbeatInterval(ms: number) {
    this.interval = ms;
    this._init();
  }

  /**
   * Resets this heartbeat.
   */
  public reset(): void {
    this.acked = false;
    this.last = 0;
    delete this.interval;

    if (this._interval) {
      Timers.clearInterval(this._interval);
      this._interval = undefined;
    }
  }

  /**
   * Called whenever the gateway sends a HeartbeatAck op.
   */
  public ack(): void {
    this.acked = true;
    this.latency = Date.now() - this.last;
    this._debug(
      `Gateway acknowledged our heartbeat, latency: ${this.latency}ms`
    );
  }

  /**
   * Sends a heartbeat to the gateway.
   * @param {string} reason The heartbeat reason.
   * @param {boolean} [ignore] The shard statuses to ignore.
   */
  public new(
    reason: string,
    ignore: boolean = [
      Status.WaitingForGuilds,
      Status.Identifying,
      Status.Resuming,
    ].includes(this.shard.status)
  ): void {
    if (ignore && !this.acked) {
      this._debug(
        "Didn't process last heartbeat ack yet but we are still connected. Sending one now..."
      );
    } else if (!this.acked) {
      this._debug(
        "Didn't receive a heartbeat last time. Assuming zombie connection, destroying and reconnecting."
      );
      this._debug(
        `Zombie Connection: Stats = ${Status[this.shard.status]}, Sequence = ${
          this.shard.sequence
        }`
      );
      return this.shard.destroy({ code: 4009, reset: true });
    }

    this._debug(`‹${reason}› Sending a heartbeat to the gateway.`);
    this.shard.send({ op: GatewayOpCode.Heartbeat, d: this.shard.sequence });
    this.acked = false;
    this.last = Date.now();
  }

  /**
   * Emits a heartbeat event on the internal sharding manager.
   * @private
   */
  private _debug(message: string): void {
    this.shard.manager.emit(
      "debug",
      `(Shard ${this.shard.id}) Heartbeat: ${message}`
    );
    return;
  }

  /**
   * Initializes the heartbeat interval.
   * @private
   */
  private _init(): void {
    this._debug(`Now sending a heartbeat every: ${this.interval} ms`);
    this._interval = Timers.setInterval(
      () => this.new("interval"),
      this.interval as number
    );
    return;
  }
}
