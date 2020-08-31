/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { constants, createUnzip, Unzip } from "zlib";
import { Compressible, Compression } from "./Compression";
import { CustomError } from "../../errors/CustomError";

export class Zlib extends Compression {
  /**
   * The unzip instance.
   * @private
   */
  private _zlib!: Unzip;

  /**
   * Decompressed data chunks returned from zlib.
   * @private
   */
  private _chunks: Buffer[] = [];

  /**
   * Temporary storage of compressed chunks while zlib is flushing.
   * @private
   */
  private _incomingChunks: Buffer[] = []

  /**
   * Whether or not zlib is currently flushing or not.
   * @private
   */
  private _flushing = false;

  /**
   * Adds data to the zlib unzip.
   * @param data
   */
  public add(data: Compressible): void {
    if (data instanceof Buffer) {
      this._addBuffer(data);
      return;
    } else if (Array.isArray(data)) {
      this.emit("debug", "Received fragmented buffer message.");
      data.forEach(buf => this._addBuffer(buf));
      return;
    } else if (data instanceof ArrayBuffer) {
      this.emit("debug", "Received array buffer message.");
      this._addBuffer(Buffer.from(data));
      return;
    }

    this.emit("error", new CustomError("ProcessingError", "Received invalid data."));
  }

  /**
   * Instantiates the unzip instance.
   * @protected
   */
  protected init(): void {
    this._flush = this._flush.bind(this);

    this._zlib = createUnzip({
      flush: constants.Z_SYNC_FLUSH,
      chunkSize: 128 * 1024
    })
      .on("data", c => this._chunks.push(c))
      .on("error", e => this.emit("error", e));
  }

  /**
   * @private
   */
  private _addBuffer(buf: Buffer): void {
    this._flushing
      ? this._incomingChunks.push(buf)
      : this._write(buf);
  }

  /**
   * Called whenever zlib finishes flushing.
   * @private
   */
  private _flush() {
    this._flushing = false;
    if (!this._chunks.length) return;

    let buf = this._chunks[0];
    if (this._chunks.length > 1) {
      buf = Buffer.concat(this._chunks);
    }

    this._chunks = [];
    while (this._incomingChunks.length > 0) {
      const next = this._incomingChunks.shift();
      if (next && this._write(next)) break;
    }

    this.emit("data", buf);
  }

  /**
   * Writes data to the zlib unzip and initiates flushing if all data has been received.
   * @private
   */
  private _write(buf: Buffer) {
    this._zlib.write(buf);

    const l = buf.length;
    if (l >= 4 && buf.readUInt32BE(l - 4) === 0xFFFF) {
      this._flushing = true;
      this._zlib.flush(constants.Z_SYNC_FLUSH, this._flush);
      return true;
    }

    return false;
  }
}
