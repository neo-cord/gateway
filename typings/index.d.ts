import { BitField, BitFieldObject, Collection, Emitter } from "@neocord/utils";
import { EventEmitter } from "events";

export class CustomError {
  /**
   * @param name The name of the custom error.
   * @param message The error message.
   */
  constructor(name: string, message: string);
}

export class InternalShard extends Emitter {
  /**
   * The internal sharding manager.
   */
  readonly manager: InternalShardingManager;
  /**
   * The ID of this shard.
   */
  readonly id: number;
  /**
   * This shard's heartbeat handler..
   */
  readonly heartbeat: Heartbeat;
  /**
   * This shard's session handler.
   */
  readonly session: Session;
  /**
   * The status of this shard..
   */
  status: Status;
  /**
   * When this shard connected to the gateway.
   */
  connectedAt: number;
  /**
   * Whether or not this shard is managed by the internal sharding manager.
   */
  managed: boolean;
  /**
   * Guilds that are expected to be received.
   */
  expectingGuilds?: Set<string>;

  /**
   * Creates a new InternalShard instance.
   * @param manager The ISM instance.
   * @param id The ID of this shard.
   */
  constructor(manager: InternalShardingManager, id: number);

  /**
   * The current sequence.
   */
  get sequence(): number;

  /**
   * The sequence when the socket closed.
   */
  get closingSequence(): number;

  /**
   * The latency of this shard.
   */
  get latency(): number;

  /**
   * Whether or not this shard is connected.
   */
  get connected(): boolean;

  /**
   * Send a new payload to the gateway.
   * @param data The payload to send.
   * @param prioritized Whether or not to prioritize this payload.
   */
  send(data: Payload, prioritized?: boolean): void;

  destroy(options?: DestroyOptions): void;

  /**
   * Connects to the discord gateway.
   */
  connect(): void;
}

export interface DestroyOptions {
  code?: number;
  reset?: boolean;
  emit?: boolean;
  log?: boolean;
}

/**
 * Handles internalized bot sharding.
 */
export class InternalShardingManager extends Emitter {
  /**
   * All shards currently being managed by the ISM.
   */
  readonly shards: Collection<number, InternalShard>;
  /**
   * The compression to use.
   */
  compression: CompressionType | false;
  /**
   * Whether or not the ISM is ready.
   */
  ready: boolean;
  /**
   * The type of serialization.
   */
  useEtf: boolean;
  /**
   * The options provided to this ISM instance.
   */
  options: Required<ISMOptions>;
  /**
   * Whether or not this internal sharding manager is destroyed.
   */
  destroyed: boolean;
  /**
   * Whether or not this manager is reconnecting.
   */
  reconnecting: boolean;
  /**
   * The gateway address.
   */
  gatewayUrl: string;

  /**
   * Creates a new InternalShardingManager.
   * @param options
   */
  constructor(options?: ISMOptions);

  /**
   * The bot token.
   */
  get token(): string;
  /**
   * Set the token to use.
   * @param token The discord bot token.
   */
  set token(token: string);

  /**
   * Destroys this manager.
   */
  destroy(): void;

  /**
   * Connects all shards.
   */
  connect(): Promise<void>;
}

export interface ISMOptions {
  shards?: number | number[] | "auto";
  shardCount?: number | null;
  /**
   * The type of zlib compression to use, if you even want it.
   */
  compression?: CompressionType | boolean;
  /**
   * Whether or not to use etf encoding. Must have "erlpack" installed.
   */
  useEtf?: boolean;
  /**
   * The intents to use.
   */
  intents?: number;
  /**
   * Set a custom gateway url. Defaults to "auto".
   */
  url?: "auto" | string;
  /**
   * The gateway version to use.
   */
  version?: number;
  /**
   * The device properties.
   */
  properties?: {
    $device: string;
    $browser: string;
    $os: string;
  };
}

export interface SessionInfo {
  url: string;
  shards: number;
  session_start_limit: SessionStartLimit;
}

export interface SessionStartLimit {
  total: number;
  remaining: number;
  reset_after: number;
}

export enum GatewayIntent {
  Guilds = 1,
  GuildMembers = 2,
  GuildBans = 4,
  GuildEmojis = 8,
  GuildIntegrations = 16,
  GuildWebhooks = 32,
  GuildInvites = 64,
  GuildVoiceStates = 128,
  GuildPresences = 256,
  GuildMessages = 256,
  GuildMessageReactions = 1024,
  GuildMessageTyping = 2048,
  DirectMessages = 4096,
  DirectMessageReactions = 8192,
  DirectMessageTyping = 16384
}

export class Intents extends BitField<IntentResolvable> {
  /**
   * All intents that were provided by discord.
   */
  static FLAGS: typeof GatewayIntent;
  /**
   * All privileged intents ORed together.
   */
  static PRIVILEGED: number;
  /**
   * All of the non-privileged intents.
   */
  static NON_PRIVILEGED: number;
  /**
   * Recommended defaults by NeoCord.
   */
  static DEFAULT: number;
}

export type IntentResolvable =
  GatewayIntent
  | keyof typeof GatewayIntent
  | number
  | BitFieldObject
  | ((keyof typeof GatewayIntent) | number | BitFieldObject)[];

export enum GatewayOpCode {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11
}

export enum GatewayEvent {
  Ready = "READY",
  Resumed = "RESUMED",
  GuildCreate = "GUILD_CREATE",
  GuildDelete = "GUILD_DELETE",
  GuildUpdate = "GUILD_UPDATE",
  InviteCreate = "INVITE_CREATE",
  InviteDelete = "INVITE_DELETE",
  GuildMemberAdd = "GUILD_MEMBER_ADD",
  GuildMemberRemove = "GUILD_MEMBER_REMOVE",
  GuildMemberUpdate = "GUILD_MEMBER_UPDATE",
  GuildMembersChunk = "GUILD_MEMBERS_CHUNK",
  GuildIntegrationsUpdate = "GUILD_INTEGRATIONS_UPDATE",
  GuildRoleCreate = "GUILD_ROLE_CREATE",
  GuildRoleDelete = "GUILD_ROLE_DELETE",
  GuildRoleUpdate = "GUILD_ROLE_UPDATE",
  GuildBanAdd = "GUILD_BAN_ADD",
  GuildBanRemove = "GUILD_BAN_REMOVE",
  GuildEmojisUpdate = "GUILD_EMOJIS_UPDATE",
  ChannelCreate = "CHANNEL_CREATE",
  ChannelDelete = "CHANNEL_DELETE",
  ChannelUpdate = "CHANNEL_UPDATE",
  ChannelPinsUpdate = "CHANNEL_PINS_UPDATE",
  MessageCreate = "MESSAGE_CREATE",
  MessageDelete = "MESSAGE_DELETE",
  MessageUpdate = "MESSAGE_UPDATE",
  MessageDeleteBulk = "MESSAGE_DELETE_BULK",
  MessageReactionAdd = "MESSAGE_REACTION_ADD",
  MessageReactionRemove = "MESSAGE_REACTION_REMOVE",
  MessageReactionRemoveAll = "MESSAGE_REACTION_REMOVE_ALL",
  MessageReactionRemoveEmoji = "MESSAGE_REACTION_REMOVE_EMOJI",
  UserUpdate = "USER_UPDATE",
  PresenceUpdate = "PRESENCE_UPDATE",
  TypingStart = "TYPING_START",
  VoiceStateUpdate = "VOICE_STATE_UPDATE",
  VoiceServerUpdate = "VOICE_SERVER_UPDATE",
  WebhooksUpdate = "WEBHOOKS_UPDATE"
}

export enum GatewayCloseCode {
  UnknownError = 4000,
  UnknownOpCode = 4001,
  DecodeError = 4002,
  NotAuthenticated = 4003,
  AuthenticationFailed = 4004,
  AlreadyAuthenticated = 4005,
  InvalidSeq = 4007,
  RateLimited = 4008,
  SessionTimedOut = 4009,
  InvalidShard = 4010,
  ShardingRequired = 4011,
  InvalidAPIVersion = 4012,
  InvalidIntents = 4013,
  DisallowedIntents = 4014
}

export enum Status {
  Connected = 0,
  Idle = 1,
  Ready = 2,
  Resuming = 3,
  Identifying = 4,
  Reconnecting = 5,
  Nearly = 6,
  Disconnected = 7,
  Connecting = 8,
  WaitingForGuilds = 9
}

export enum ShardEvent {
  Error = "error",
  Close = "close",
  Ready = "ready",
  Resumed = "resumed",
  InvalidSession = "invalidSession",
  Destroyed = "destroyed",
  FullReady = "fullReady"
}

export enum ISMEvent {
  Ready = "ready",
  ShardError = "shardError",
  ShardReady = "shardReady",
  RawPacket = "raw",
  ShardDisconnect = "shardDisconnected",
  ShardReconnecting = "shardReconnecting",
  Invalidated = "invalidated",
  Debug = "debug"
}

export interface Payload<D = unknown> {
  op: GatewayOpCode;
  t?: GatewayEvent | null;
  d?: D;
  s?: number | null;
}

export const API = "https://discord.com/api/v8";
export const USER_AGENT = "NeoCord (v1 https://github.com/neo-cord)";
export const DEFAULTS: ISMOptions;

export class ZlibSync extends Compression {
  /**
   * Adds data to the zlib inflate.
   * @param data
   */
  add(data: Compressible): void;

  /**
   * Instantiates the zlib inflate.
   * @protected
   */
  protected init(): void;
}

export class Zlib extends Compression {
  /**
   * Adds data to the zlib unzip.
   * @param data
   */
  add(data: Compressible): void;

  /**
   * Instantiates the unzip instance.
   * @protected
   */
  protected init(): void;
}

/**
 * Used for decompressing data sent by the discord gateway.
 */
export abstract class Compression extends EventEmitter {
  /**
   * Creates a new Compression instance.
   */
  protected constructor();

  /**
   * Returns a new compression instance.
   * @param type The type of compression to use, only "zlib" and "zlib-sync" are supported.
   */
  static create(type: CompressionType): Compression;

  /**
   * Emitted when decompressed data is available.
   * @param event
   * @param listener
   */
  on(event: "data", listener: (data: Buffer) => void): this;

  /**
   * Emitted when the compression handler runs into an error.
   * @param event
   * @param listener
   */
  on(event: "error", listener: (data: Error) => void): this;

  /**
   * Used for debugging the compression handler.
   * @param event
   * @param listener
   */
  on(event: "debug", listener: (message: string) => void): this;

  /**
   * Adds compressed data to the compression handler.
   * @param data
   */
  abstract add(data: Compressible): void;

  /**
   * Initializes the compression handler.
   * @protected
   */
  protected abstract init(): void;
}

export type CompressionType = "zlib" | "zlib-sync" | "pako";
export type Compressible = string | ArrayBuffer | Buffer | Buffer[];

export class Session {
  /**
   * The shard that this session is for.
   */
  readonly shard: InternalShard;
  /**
   * The id of this session.
   */
  id?: string;

  /**
   * @param shard
   */
  constructor(shard: InternalShard);

  /**
   * The sharding manager.
   */
  get manager(): InternalShardingManager;

  /**
   * Resets the session.
   */
  reset(): void;

  /**
   * Sets a timeout for the HELLO op.
   */
  waitForHello(): void;

  /**
   * Clears the HELLO timeout and identifies a new session.
   */
  hello(): void;

  /**
   * Resumes or created a new session.
   */
  identify(): void;

  /**
   * Identify a new session.
   */
  new(): void;

  /**
   * Resumes the current session.
   */
  resume(): void;
}

/**
 * Handles a shards heartbeat.
 */
export class Heartbeat {
  /**
   * Whether or not our last heartbeat was acknowledged.
   */
  acked: boolean;
  /**
   * When we last sent a heartbeat.
   */
  last: number;
  /**
   * The heartbeat interval.
   */
  interval?: number;
  /**
   * The shard this heartbeat belongs to.
   */
  shard: InternalShard;
  /**
   * The heartbeat latency.
   */
  latency: number;

  /**
   * @param shard
   */
  constructor(shard: InternalShard);

  /**
   * Sets the heartbeat interval.
   * @param ms
   */
  set heartbeatInterval(ms: number);

  /**
   * Resets this heartbeat.
   */
  reset(): void;

  /**
   * Called whenever the gateway sends a HeartbeatAck op.
   */
  ack(): void;

  /**
   * Sends a heartbeat to the gateway.
   * @param reason The heartbeat reason.
   */
  new(reason: string): void;
}

/**
 * Serialization handler for the JSON format. Uses the builtin JSON.parse and stringify methods.
 */
export class Json extends Serialization {
  /**
   * Encodes a payload into a json string.
   * @param payload The payload to encode.
   */
  encode(payload: Payload): string;

  /**
   * Decodes a decompressed websocket packet.
   * @param raw The decompressed websocket packet.
   */
  decode(raw: RawData): Payload;
}

/**
 * Serialization handler for the ETF format.
 */
export class Erlpack extends Serialization {
  /**
   * Encodes a payload into the etf format.
   * @param payload The payload to encode.
   */
  encode(payload: Payload): Buffer;

  /**
   * Decodes a decompressed websocket packet into a json payload.
   * @param raw Decompressed websocket packet.
   */
  decode(raw: RawData): Payload;
}

export abstract class Serialization {
  /**
   * Returns a new serialization handler.
   * @param type The type of serialization provider.
   */
  static create(type: SerializationType): Serialization;

  /**
   * Serializes a payload for use with WebSocket#send
   * @param payload The gateway payload that will be encoded.
   */
  abstract encode(payload: Payload): Buffer | string;

  /**
   * Deserializes a WebSocket packet to a JSON Payload.
   * @param raw The received and decompressed websocket packet.
   */
  abstract decode(raw: RawData): Payload;
}

export type SerializationType = "json" | "etf";
export type RawData = string | Buffer | Buffer[] | ArrayBuffer;
