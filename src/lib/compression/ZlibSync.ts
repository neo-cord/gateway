/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { Compressible, Compression } from "./Compression";
import { CustomError } from "../../errors/CustomError";

import type Zlib from "zlib-sync";

let zlib!: typeof import("zlib-sync");
try {
  zlib = require("zlib-sync");
} catch {
  // no-op
}

export class ZlibSync extends Compression {
  /**
   * The zlib inflate instance.
   * @private
   */
  private _zlib!: Zlib.Inflate;

  /**
   * Adds data to the zlib inflate.
   * @param data
   */
  public add(data: Compressible): void {
    if (data instanceof Buffer) {
      this._addBuffer(data);
      return;
    } else if (Array.isArray(data)) {
      this.emit("debug", "Received fragmented buffer message.");
      data.forEach((buf) => this._addBuffer(buf));
      return;
    } else if (data instanceof ArrayBuffer) {
      this.emit("debug", "Received array buffer message.");
      this._addBuffer(Buffer.from(data));
      return;
    }

    this.emit(
      "error",
      new CustomError("CompressionError", "Received invalid data.")
    );
  }

  /**
   * Instantiates the zlib inflate.
   * @protected
   */
  protected init(): void {
    this._zlib = new zlib.Inflate({ chunkSize: 128 * 1024 });
    return;
  }

  /**
   * Adds a buffer to the inflate.
   * @private
   */
  private _addBuffer(buf: Buffer): void {
    const l = buf.length;
    if (l >= 4 && buf.readUInt32BE(l - 4) === 0xffff) {
      this._zlib.push(buf, zlib.Z_SYNC_FLUSH);
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
