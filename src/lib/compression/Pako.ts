/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { ZlibSync } from "./ZlibSync";
import { CustomError } from "../../errors/CustomError";

import type { Inflate } from "pako";

let pako: typeof import("pako");
try {
  pako = require("pako");
} catch {
  // no-op
}

export class Pako extends ZlibSync {
  /**
   * The pako inflate instance.
   * @private
   */
  // @ts-expect-error
  private _zlib!: Inflate;

  /**
   * Instantiates a pako inflate instance.
   * @protected
   */
  protected init(): void {
    this._zlib = new pako.Inflate({ chunkSize: 128 * 1024 });
    return;
  }

  /**
   * Adds a buffer to the inflate.
   * @private
   */
  protected _addBuffer(buf: Buffer): void {
    const l = buf.length;
    if (l >= 4 && buf.readUInt32BE(l - 4) === 0xffff) {
      this._zlib.push(buf, 2);
      if (this._zlib.err) {
        this.emit(
          "error",
          new CustomError(
            "CompressionError",
            `${this._zlib.err}: ${this._zlib.msg}`
          )
        );
        return;
      }

      if (this._zlib.result) this.emit("data", Buffer.from(this._zlib.result));

      return;
    }

    this._zlib.push(buf);
    return;
  }
}
