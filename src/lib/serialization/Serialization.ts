/**
 * Used for deserializing and serializing data.
 */
import { CustomError } from "../../errors/CustomError";

import type { Payload } from "../../constants";

export abstract class Serialization {
  /**
   * Returns a new serialization handler.
   * @param type The type of serialization provider.
   */
  public static create(type: SerializationType): Serialization {
    switch (type) {
      case "etf":
        try {
          require("erlpack");
        } catch {
          throw new CustomError("SerializationError", "Module 'erlpack' not found.");
        }

        return new (require("./Erlpack")).Erlpack();
      case "json":
        return new (require("./Json")).Json();
      default:
        throw new TypeError(`Invalid serialization type: ${type}`);
    }
  }

  /**
   * Serializes a payload for use with WebSocket#send
   * @param payload The gateway payload that will be encoded.
   */
  public abstract encode(payload: Payload): Buffer | string;

  /**
   * Deserializes a WebSocket packet to a JSON Payload.
   * @param raw The received and decompressed websocket packet.
   */
  public abstract decode(raw: RawData): Payload;
}

export type SerializationType = "json" | "etf";
export type RawData = string | Buffer | Buffer[] | ArrayBuffer;