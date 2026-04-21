import { WoWPlayer } from '@mythicplus/shared';
import {
  ROLE_BREZ,
  ROLE_HEALER,
  ROLE_HEALER_OFFSPEC,
  ROLE_LUST,
  ROLE_MELEE,
  ROLE_MELEE_OFFSPEC,
  ROLE_RANGED,
  ROLE_TANK,
  ROLE_TANK_OFFSPEC,
} from './config.js';
import { getPreferenceService } from './preferenceService.js';

export interface DiscordMember {
  nick?: string | null;
  global_name?: string | null;
  id: string;
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

export function getDebugPlayers(): WoWPlayer[] {
  return [
    WoWPlayer.create('Martz', [ROLE_HEALER, ROLE_TANK_OFFSPEC, ROLE_MELEE_OFFSPEC, ROLE_BREZ]),
    WoWPlayer.create('KingofSkillz', [ROLE_RANGED, ROLE_LUST]),
    WoWPlayer.create('chaoswaffles', [ROLE_MELEE, ROLE_TANK_OFFSPEC]),
    WoWPlayer.create('Upartyhardy', [ROLE_RANGED]),
    WoWPlayer.create('Pandemonium', [ROLE_TANK, ROLE_MELEE_OFFSPEC, ROLE_BREZ]),
    WoWPlayer.create('Will', [ROLE_MELEE]),
    WoWPlayer.create('Tytanium', [ROLE_RANGED, ROLE_HEALER_OFFSPEC, ROLE_LUST]),
    WoWPlayer.create('hammer13', [ROLE_MELEE]),
    WoWPlayer.create('Ultra9', [ROLE_RANGED, ROLE_LUST]),
    WoWPlayer.create('DrZoidberg', [ROLE_RANGED]),
    WoWPlayer.create('Player1x', [ROLE_RANGED, ROLE_HEALER_OFFSPEC, ROLE_LUST]),
    WoWPlayer.create('lizardtotem', [ROLE_HEALER, ROLE_MELEE_OFFSPEC]),
    WoWPlayer.create('rorschach128', [ROLE_MELEE]),
  ];
}
