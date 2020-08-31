/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { RawData, Serialization } from "./Serialization";

import type { Payload } from "../../constants";
import { CustomError } from "../../errors/CustomError";

let etf: typeof import("erlpack");
try {
  etf = require("erlpack");
} catch {
  // no-op
}

/**
 * Serialization handler for the ETF format.
 */
export class Erlpack extends Serialization {
  /**
   * Encodes a payload into the etf format.
   * @param payload The payload to encode.
   */
  public encode(payload: Payload): Buffer {
    return etf.pack(payload);
  }

  /**
   * Decodes a decompressed websocket packet into a json payload.
   * @param raw Decompressed websocket packet.
   */
  public decode(raw: RawData): Payload {
    let _raw: Buffer | null = null;

    if (raw instanceof Buffer) _raw = raw;
    else if (Array.isArray(raw)) _raw = Buffer.concat(raw);
    else if (raw instanceof ArrayBuffer) _raw = Buffer.from(raw);

    if (!_raw) {
      throw new CustomError("SerializationError", "Received invalid data.");
    }

    return etf.unpack(_raw);
  }
}