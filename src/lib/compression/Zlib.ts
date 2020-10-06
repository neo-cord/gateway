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
   * @type {Unzip}
   * @private
   */
  protected _zlib!: Unzip;

  /**
   * Decompressed data chunks returned from zlib.
   * @type {Buffer[]}
   * @private
   */
  #chunks: Buffer[] = [];

  /**
   * Temporary storage of compressed chunks while zlib is flushing.
   * @type {Buffer[]}
   * @private
   */
  #incomingChunks: Buffer[] = [];

  /**
   * Whether or not zlib is currently flushing or not.
   * @type {boolean}
   * @private
   */
  #flushing = false;

  /**
   * Adds data to the zlib unzip.
   * @param {Compressible} data The data to compress.
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
      new CustomError("ProcessingError", "Received invalid data.")
    );
  }

  /**
   * Instantiates the unzip instance.
   * @protected
   */
  protected init(): void {
    this._flush = this._flush.bind(this);

    this._zlib = createUnzip({
      flush: constants.Z_SYNC_FLUSH,
      chunkSize: 128 * 1024,
    })
      .on("data", (c) => this.#chunks.push(c))
      .on("error", (e) => this.emit("error", e));
  }

  /**
   * Adds a buffer to the inflate.
   * @param {Buffer} buf The buffer.
   * @private
   */
  private _addBuffer(buf: Buffer): void {
    this.#flushing ? this.#incomingChunks.push(buf) : this._write(buf);
  }

  /**
   * Called whenever zlib finishes flushing.
   * @private
   */
  private _flush() {
    this.#flushing = false;
    if (!this.#chunks.length) return;

    let buf = this.#chunks[0];
    if (this.#chunks.length > 1) {
      buf = Buffer.concat(this.#chunks);
    }

    this.#chunks = [];
    while (this.#incomingChunks.length > 0) {
      const next = this.#incomingChunks.shift();
      if (next && this._write(next)) break;
    }

    this.emit("data", buf);
  }

  /**
   * Writes data to the zlib unzip and initiates flushing if all data has been received.
   * @param {Buffer} buf The buffer to add.
   * @private
   */
  private _write(buf: Buffer) {
    this._zlib.write(buf);

    const l = buf.length;
    if (l >= 4 && buf.readUInt32BE(l - 4) === 0xffff) {
      this.#flushing = true;
      this._zlib.flush(constants.Z_SYNC_FLUSH, this._flush);
      return true;
    }

    return false;
  }
}
