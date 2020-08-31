/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { Timers } from "@neocord/utils";
import { GatewayOpCode, Status } from "../../constants";

import type { InternalShard } from "../InternalShard";
import type { InternalShardingManager } from "../Manager";

export class Session {
  /**
   * The shard that this session is for.
   */
  public readonly shard: InternalShard;

  /**
   * The id of this session.
   */
  public id?: string;

  /**
   * The hello timeout.
   * @private
   */
  private _helloTimeout?: NodeJS.Timeout;

  /**
   * @param shard
   */
  public constructor(shard: InternalShard) {
    this.shard = shard;
  }

  /**
   * The sharding manager.
   */
  public get manager(): InternalShardingManager {
    return this.shard.manager;
  }

  /**
   * Resets the session.
   */
  public reset(): void {
    delete this.id;
    if (this._helloTimeout) {
      Timers.clearTimeout(this._helloTimeout);
      delete this._helloTimeout;
    }
  }

  /**
   * Sets a timeout for the HELLO op.
   */
  public waitForHello(): void {
    this._debug("Setting the hello timeout for 30s");
    this._helloTimeout = Timers.setTimeout(() => {
      this._debug("Did not receive HELLO op in time. Destroying and reconnecting.");
      this.shard.destroy({ reset: true, code: 4000 });
    }, 3e5);
  }

  /**
   * Clears the HELLO timeout and identifies a new session.
   */
  public hello(): void {
    if (this._helloTimeout) {
      Timers.clearTimeout(this._helloTimeout);
      delete this._helloTimeout;
    }

    this.identify();
  }

  /**
   * Resumes or created a new session.
   */
  public identify(): void {
    return this.id
      ? this.resume()
      : this.new();
  }

  /**
   * Identify a new session.
   */
  public new(): void {
    if (!this.manager.token) {
      this._debug("No token available.");
      return;
    }

    const d = {
      token: this.manager.token,
      properties: this.manager.options.properties,
      shard: [ this.shard.id, Number(this.manager.options.shardCount) ],
      intents: this.manager.options.intents,
    };

    this._debug("Identifying as a new session...");
    this.shard.send({ op: GatewayOpCode.Identify, d }, true);
  }

  /**
   * Resumes the current session.
   */
  public resume(): void {
    if (!this.id) {
      this._debug("No session id; Identifying as a new session.");
      this.new();
      return;
    }

    this.shard.status = Status.Resuming;
    const d = {
      token: this.manager.token,
      sequence: this.shard.closingSequence,
      session_id: this.id
    };

    this._debug(`Resuming ${this.id}; Sequence = ${this.shard.closingSequence}`);
    this.shard.send({ op: GatewayOpCode.Resume, d }, true);
  }

  /**
   * @private
   */
  private _debug(message: string): number {
    return this.manager.emit(`(Shard ${this.shard}) Session: ${message.trim()}`);
  }
}
