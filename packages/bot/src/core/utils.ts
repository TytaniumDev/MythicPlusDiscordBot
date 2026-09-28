import type { LobbyMember } from '@mythicplus/shared';

export interface DiscordMember {
  nick?: string | null;
  global_name?: string | null;
  id: string;
  bot: boolean;
  toString(): string;
}

export interface TypingChannel {
  sendTyping(): Promise<void>;
}

export function getWowName(member: DiscordMember): string {
  const rawName = member.nick ?? member.global_name ?? member.toString();
  return rawName.replace(/\./g, '');
}

export async function showLongTyping(
  channel: TypingChannel,
  debugMode = false,
): Promise<void> {
  if (!debugMode) {
    await channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export async function showShortTyping(
  channel: TypingChannel,
  debugMode = false,
): Promise<void> {
  if (!debugMode) {
    await channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function getMaskedName(name: string): string {
  return '?'.repeat(name.length);
}

/** The lobby-doc entry for a voice channel member. */
export function toLobbyMember(member: DiscordMember): LobbyMember {
  return { discordId: String(member.id), name: getWowName(member) };
}
