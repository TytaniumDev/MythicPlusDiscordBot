import { WoWPlayer } from '@mythicplus/shared';
import { getPreferenceService } from './preferenceService.js';

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

export function getPlayerFromMember(member: DiscordMember): WoWPlayer {
  const name = getWowName(member);
  const discordId = String(member.id);
  const prefSvc = getPreferenceService();
  let savedRoles = prefSvc.getPreferenceSync(discordId);
  if (!savedRoles) {
    savedRoles = prefSvc.getPreferenceByNameSync(name);
  }
  const inGameName = prefSvc.getInGameNameSync(discordId);
  const mediaUrl = prefSvc.getMediaUrlSync(discordId);
  const characterClass = prefSvc.getCharacterClassSync(discordId);
  if (savedRoles) {
    return WoWPlayer.create(name, savedRoles, discordId, inGameName, mediaUrl, characterClass);
  }
  return WoWPlayer.fromFlags({ name, discordId, inGameName });
}

export function getPlayerList(members: DiscordMember[]): WoWPlayer[] {
  return members.map(getPlayerFromMember);
}
