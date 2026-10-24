import type {
  AffixDisplay,
  WoWPlayerDict,
  WoWGroupDict,
  SessionStatus,
  CharacterClass,
  LobbyMember,
  SeasonPairs,
} from '@mythicplus/shared';

export type { SeasonPairs };

export interface WheelEntry {
  name: string;
  isOffspec: boolean;
  isChosen?: boolean;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
}

export type WoWPlayer = WoWPlayerDict;
export type WoWGroup = WoWGroupDict;

export interface GuildData {
  guildId: string;
  guildName?: string;
  guildIconUrl?: string;
  /** Decoded from either wire shape by `decodeGroupHistoryRounds`. */
  groupHistory?: {
    date: string;
    rounds: WoWGroup[][];
  };
  seasonPairs?: SeasonPairs;
  createdAt: unknown;
  lastActive: unknown;
}

export interface ChannelData {
  channelId: string;
  channelName: string;
  guildId: string;
  status: SessionStatus;
  /**
   * Who has the activity open. Written only by the `syncLobbyMembers` Cloud
   * Function; absent until it first runs.
   */
  members?: LobbyMember[];
  /** The activity instance `members` came from. A new one clears the round. */
  instanceId?: string;
  groups: WoWGroup[];
  revealedGroups?: number;
  /**
   * Server time (ms since the epoch) Spin was pressed. Every client plays the
   * reveal from it, so all screens animate together (lib/revealTimeline.ts).
   */
  revealStartAt?: number;
  claimedPlayers?: string[];
  sittingOut?: string[];
  staticWheel?: boolean;
  isDebug: boolean;
  createdAt: unknown;
  lastActive: unknown;
}

export interface SeasonConfig {
  slug: string;
  blizzardSeasonId: number;
  expansionId: number;
}

/** The `config/affixes` doc, written weekly by the `fetchWeeklyAffixes` function. */
export interface AffixData {
  period: number;
  region: string;
  affixes: AffixDisplay[];
}
