import { generateInviteCommand, type WoWGroup } from '@mythicplus/shared';
import { PLACEHOLDER_CHAR } from './config.js';
import { getMaskedName, showShortTyping } from './utils.js';

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Embed {
  title: string;
  color: number;
  fields: EmbedField[];
}

export interface Message {
  edit(options: { embed: Embed }): Promise<Message>;
}

export interface Sendable {
  send(content: string | { embed: Embed }): Promise<Message>;
}

// Gold color value matching discord.js
const GOLD = 0xf1c40f;

function setFieldAt(embed: Embed, index: number, name: string, value: string): Embed {
  embed.fields[index] = { ...embed.fields[index], name, value };
  return embed;
}

export interface GroupDisplayNames {
  tankName: string;
  healerName: string;
  dps1Name: string;
  dps2Name: string;
  dps3Name: string;
  brezPlayer: string;
  lustPlayer: string;
}

/**
 * Extracts and formats the display names of players in a given WoWGroup.
 * Ensures consistent placeholder usage for missing roles and identifies utility players.
 *
 * @param {WoWGroup} group - The generated group to extract names from.
 * @returns {GroupDisplayNames} A structured object containing formatted player names for UI display.
 */
export function getGroupDisplayNames(group: WoWGroup): GroupDisplayNames {
  const allPlayers = group.players;
  return {
    tankName: group.tank?.name ?? PLACEHOLDER_CHAR,
    healerName: group.healer?.name ?? PLACEHOLDER_CHAR,
    dps1Name: group.dps[0]?.name ?? PLACEHOLDER_CHAR,
    dps2Name: group.dps[1]?.name ?? PLACEHOLDER_CHAR,
    dps3Name: group.dps[2]?.name ?? PLACEHOLDER_CHAR,
    brezPlayer: allPlayers.find((p) => p.hasBrez)?.name ?? 'None',
    lustPlayer: allPlayers.find((p) => p.hasLust)?.name ?? 'None',
  };
}

/**
 * Generates an 'Invite Command' Discord EmbedField for a group, if applicable.
 * Formats the raw string into a proper Discord code block.
 *
 * @param {WoWGroup} group - The group to generate the invite command for.
 * @returns {EmbedField | null} The formatted EmbedField, or null if generation fails.
 */
export function getInviteCommandField(group: WoWGroup): EmbedField | null {
  const inviteCmd = generateInviteCommand(group.toDict());
  if (!inviteCmd) return null;
  const formatted = inviteCmd.includes('\n')
    ? `\`\`\`\n${inviteCmd}\n\`\`\``
    : `\`${inviteCmd}\``;
  return { name: 'Invite Command', value: formatted };
}

export function buildGroupEmbed(group: WoWGroup, groupNumber: number): Embed {
  const names = getGroupDisplayNames(group);

  const fields: EmbedField[] = [
    { name: 'Tank', value: names.tankName },
    { name: 'Healer', value: names.healerName },
    { name: 'DPS', value: `${names.dps1Name}, ${names.dps2Name}, ${names.dps3Name}` },
    { name: 'Battle Res', value: names.brezPlayer, inline: true },
    { name: 'Bloodlust', value: names.lustPlayer, inline: true },
  ];

  const inviteField = getInviteCommandField(group);
  if (inviteField) {
    fields.push(inviteField);
  }

  return { title: `Group ${groupNumber}`, color: GOLD, fields };
}

interface TypingChannel {
  sendTyping(): Promise<void>;
}

async function animateUpdate(
  message: Message,
  channel: TypingChannel,
  embed: Embed,
  index: number,
  name: string,
  value: string,
  debug: boolean,
): Promise<Message> {
  await showShortTyping(channel, debug);
  return message.edit({ embed: setFieldAt(embed, index, name, value) });
}

/**
 * Executes a staggered, animated reveal of a group's composition in a Discord channel.
 * Uses typing indicators and sequential message edits to simulate building the embed dynamically.
 *
 * @param {Sendable} ctx - The context used to send the initial message.
 * @param {TypingChannel} channel - The channel where typing indicators are displayed.
 * @param {WoWGroup} group - The group being announced.
 * @param {number} groupNumber - The assigned number of the group.
 * @param {boolean} debug - If true, skips artificial delays.
 * @returns {Promise<void>} Resolves when the entire animation sequence is complete.
 */
export async function announceGroupAnimated(
  ctx: Sendable,
  channel: TypingChannel,
  group: WoWGroup,
  groupNumber: number,
  debug: boolean,
): Promise<void> {
  const names = getGroupDisplayNames(group);

  const embed: Embed = {
    title: `Group ${groupNumber}`,
    color: GOLD,
    fields: [
      { name: 'Tank', value: getMaskedName(names.tankName) },
      { name: 'Healer', value: getMaskedName(names.healerName) },
      {
        name: 'DPS',
        value: `${getMaskedName(names.dps1Name)}, ${getMaskedName(names.dps2Name)}, ${getMaskedName(names.dps3Name)}`,
      },
      { name: 'Battle Res', value: getMaskedName(names.brezPlayer), inline: true },
      { name: 'Bloodlust', value: getMaskedName(names.lustPlayer), inline: true },
    ],
  };

  let embedMessage = await ctx.send({ embed });
  embedMessage = await animateUpdate(
    embedMessage, channel, embed, 0, 'Tank', names.tankName, debug,
  );
  embedMessage = await animateUpdate(
    embedMessage, channel, embed, 1, 'Healer', names.healerName, debug,
  );
  embedMessage = await animateUpdate(
    embedMessage, channel, embed, 2, 'DPS',
    `${names.dps1Name}, ${getMaskedName(names.dps2Name)}, ${getMaskedName(names.dps3Name)}`, debug,
  );
  embedMessage = await animateUpdate(
    embedMessage, channel, embed, 2, 'DPS',
    `${names.dps1Name}, ${names.dps2Name}, ${getMaskedName(names.dps3Name)}`, debug,
  );
  embedMessage = await animateUpdate(
    embedMessage, channel, embed, 2, 'DPS',
    `${names.dps1Name}, ${names.dps2Name}, ${names.dps3Name}`, debug,
  );
  embedMessage = await embedMessage.edit({
    embed: setFieldAt(embed, 3, 'Battle Res', names.brezPlayer),
  });
  embedMessage = await embedMessage.edit({
    embed: setFieldAt(embed, 4, 'Bloodlust', names.lustPlayer),
  });

  const inviteField = getInviteCommandField(group);
  if (inviteField) {
    embed.fields.push(inviteField);
    await embedMessage.edit({ embed });
  }
}

export async function announceGroup(
  ctx: Sendable,
  channel: TypingChannel,
  group: WoWGroup,
  groupNumber: number,
  debug: boolean,
): Promise<void> {
  if (debug) {
    const embed = buildGroupEmbed(group, groupNumber);
    await ctx.send({ embed });
  } else {
    await announceGroupAnimated(ctx, channel, group, groupNumber, debug);
  }
}
