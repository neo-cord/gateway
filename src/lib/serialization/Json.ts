/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { RawData, Serialization } from "./Serialization";
import { CustomError } from "../../errors/CustomError";

import type { Payload } from "../../constants";

/**
 * Serialization handler for the JSON format. Uses the builtin JSON.parse and stringify methods.
 */
export class Json extends Serialization {
  /**
   * Encodes a payload into a json string.
   * @param payload The payload to encode.
   */
  public encode(payload: Payload): string {
    return JSON.stringify(payload);
  }

  /**
   * Decodes a decompressed websocket packet.
   * @param raw The decompressed websocket packet.
   */
  public decode(raw: RawData): Payload {
    try {
      if (typeof raw === "string" || raw instanceof Buffer || raw instanceof ArrayBuffer) {
        return JSON.parse(raw.toString());
      }

      if (Array.isArray(raw)) {
        return JSON.parse(Buffer.concat(raw).toString());
      }

      throw "Received invalid data.";
    } catch (e) {
      throw new CustomError("SerializationError", e.message);
    }
  }
}