/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { RawData, Serialization } from "./Serialization";
import { CustomError, Payload } from "../..";

let erlpack: typeof import("etf.js");
try {
  erlpack = require("etf.js");
} catch {
  // no-op
}

export class EtfJS extends Serialization {
  /**
   * Encodes a payload into the etf format.
   * @param {Payload} payload The payload to encode.
   * @returns {Uint8Array}
   */
  public encode(payload: Payload): Uint8Array {
    return erlpack.pack(payload);
  }

  /**
   * Decodes a decompressed websocket packet into a json payload.
   * @param {RawData} raw Decompressed websocket packet.
   * @returns {Payload}
   */
  public decode(raw: RawData): Payload {
    let _raw: Buffer | null = null;

    if (raw instanceof Buffer) _raw = raw;
    else if (Array.isArray(raw)) _raw = Buffer.concat(raw);
    else if (raw instanceof ArrayBuffer) _raw = Buffer.from(raw);

    if (!_raw) {
      throw new CustomError("SerializationError", "Received invalid data.");
    }

    return erlpack.unpack(_raw) as Payload;
  }
}
