/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { RawData, Serialization } from "./Serialization";
import { CustomError } from "../../errors/CustomError";

import type { Payload } from "../../util/constants";

/**
 * Serialization handler for the JSON format. Uses the builtin JSON.parse and stringify methods.
 */
export class Json extends Serialization {
  /**
   * Encodes a payload into a json string.
   * @param {Payload} payload The payload to encode.
   * @returns {string}
   */
  public encode(payload: Payload): string {
    return JSON.stringify(payload);
  }

  /**
   * Decodes a decompressed websocket packet.
   * @param {RawData} raw The decompressed websocket packet.
   * @returns {Payload}
   */
  public decode(raw: RawData): Payload {
    try {
      if (
        typeof raw === "string" ||
        raw instanceof Buffer ||
        raw instanceof ArrayBuffer
      ) {
        return JSON.parse(raw.toString());
      }

      if (Array.isArray(raw)) {
        return JSON.parse(Buffer.concat(raw).toString());
      }

      throw new Error("Received invalid data.");
    } catch (e) {
      throw new CustomError("SerializationError", e.message);
    }
  }
}
