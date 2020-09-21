/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { CustomError } from "../../errors/CustomError";
import { EventEmitter } from "events";

/**
 * Used for decompressing data sent by the discord gateway.
 */
export abstract class Compression extends EventEmitter {
  protected constructor() {
    super();

    this.init();
  }

  /**
   * Emitted when decompressed data is available.
   */
  public on(event: "data", listener: (data: Buffer) => void): this;

  /**
   * Emitted when the compression handler runs into an error.
   */
  public on(event: "error", listener: (data: Error) => void): this;

  /**
   * Used for debugging the compression handler.
   */
  public on(event: "debug", listener: (message: string) => void): this;
  public on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /**
   * Returns a new compression instance.
   * @param {CompressionType} type The type of compression to use, only "zlib" and "zlib-sync" are supported.
   */
  public static create(type: CompressionType): Compression {
    switch (type) {
      case "zlib":
        return new (require("./Zlib").Zlib)();
      case "zlib-sync":
        try {
          require("zlib-sync");
        } catch (e) {
          void e;
          throw new CustomError(
            "CompressionError",
            "Module 'zlib-sync' not found."
          );
        }

        return new (require("./ZlibSync").ZlibSync)();
      case "pako":
        try {
          require("pako");
        } catch (e) {
          void e;
          throw new CustomError("CompressionError", "Module 'pako' not found.");
        }

        return new (require("./Pako").Pako)();
      default:
        throw new TypeError(`Invalid compression type: ${type}`);
    }
  }

  /**
   * Adds compressed data to the compression handler.
   * @param {Compressible} data
   */
  public abstract add(data: Compressible): void;

  /**
   * Initializes the compression handler.
   * @protected
   */
  protected abstract init(): void;
}

export type CompressionType = "zlib" | "zlib-sync" | "pako";
export type Compressible = string | ArrayBuffer | Buffer | Buffer[];
