/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { BitField, BitFieldObject } from "@neocord/utils";

const intents = {
  Guilds: 1 << 0,
  GuildMembers: 1 << 1,
  GuildBans: 1 << 2,
  GuildEmojis: 1 << 3,
  GuildIntegrations: 1 << 4,
  GuildWebhooks: 1 << 5,
  GuildInvites: 1 << 6,
  GuildVoiceStates: 1 << 7,
  GuildPresences: 1 << 8,
  GuildMessages: 1 << 8,
  GuildMessageReactions: 1 << 10,
  GuildMessageTyping: 1 << 11,
  DirectMessages: 1 << 12,
  DirectMessageReactions: 1 << 13,
  DirectMessageTyping: 1 << 14
};

export class Intents extends BitField<IntentResolvable> {
  /**
   * All intents that were provided by discord.
   */
  public static FLAGS = intents
  /**
   * All privileged intents ORed together.
   */
  public static PRIVILEGED = intents.GuildMembers | intents.GuildPresences;

  /**
   * All of the non-privileged intents.
   */
  public static NON_PRIVILEGED = Intents.ALL & ~Intents.PRIVILEGED;

  /**
   * Recommended defaults by NeoCord.
   */
  public static DEFAULTS = intents.Guilds
    | intents.GuildMessages
    | intents.GuildBans
    | intents.GuildEmojis
    | intents.GuildInvites
    | intents.GuildVoiceStates
    | intents.DirectMessages
}

export type IntentResolvable =
  keyof typeof intents
  | number
  | BitFieldObject
  | ((keyof typeof intents) | number | BitFieldObject)[];
