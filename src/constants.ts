/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import type { ISMOptions } from "./lib/Manager";
import { Intents } from "./lib/Intents";

export enum GatewayOpCode {
  Dispatch,
  Heartbeat,
  Identify,
  PresenceUpdate,
  VoiceStateUpdate,
  Resume = 6,
  Reconnect,
  RequestGuildMembers,
  InvalidSession,
  Hello,
  HeartbeatAck,
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
  WebhooksUpdate = "WEBHOOKS_UPDATE",
}

export enum GatewayCloseCode {
  UnknownError = 4000,
  UnknownOpCode,
  DecodeError,
  NotAuthenticated,
  AuthenticationFailed,
  AlreadyAuthenticated,
  InvalidSeq = 4007,
  RateLimited,
  SessionTimedOut,
  InvalidShard,
  ShardingRequired,
  InvalidAPIVersion,
  InvalidIntents,
  DisallowedIntents,
}

export enum Status {
  Connected,
  Idle,
  Ready,
  Resuming,
  Identifying,
  Reconnecting,
  Nearly,
  Disconnected,
  Connecting,
  WaitingForGuilds,
}

export enum ShardEvent {
  Error = "error",
  Close = "close",
  Ready = "ready",
  Resumed = "resumed",
  InvalidSession = "invalidSession",
  Destroyed = "destroyed",
  FullReady = "fullReady",
}

export enum ISMEvent {
  Ready = "ready",
  ShardError = "shardError",
  ShardReady = "shardReady",
  RawPacket = "raw",
  ShardDisconnect = "shardDisconnected",
  ShardReconnecting = "shardReconnecting",
  Invalidated = "invalidated",
  Debug = "debug",
}

export interface Payload<D = unknown> {
  op: GatewayOpCode;
  t?: GatewayEvent | null;
  d?: D;
  s?: number | null;
}

export const API = "https://discord.com/api/v8";

export const USER_AGENT = "NeoCord (v1 https://github.com/neo-cord)";

export const DEFAULTS: ISMOptions = {
  useEtf: false,
  compression: false,
  intents: Intents.DEFAULT,
  shards: "auto",
  properties: {
    $browser: "NeoCord",
    $device: "NeoCord",
    $os: process.platform,
  },
  url: "auto",
  version: 6,
};
