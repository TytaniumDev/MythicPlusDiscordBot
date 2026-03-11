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

export function buildGroupEmbed(group: WoWGroup, groupNumber: number): Embed {
  const tankName = group.tank?.name ?? PLACEHOLDER_CHAR;
  const healerName = group.healer?.name ?? PLACEHOLDER_CHAR;
  const dps1Name = group.dps.length > 0 ? group.dps[0].name : PLACEHOLDER_CHAR;
  const dps2Name = group.dps.length > 1 ? group.dps[1].name : PLACEHOLDER_CHAR;
  const dps3Name = group.dps.length > 2 ? group.dps[2].name : PLACEHOLDER_CHAR;

  const allPlayers = group.players;
  const brezPlayer = allPlayers.find((p) => p.hasBrez)?.name ?? 'None';
  const lustPlayer = allPlayers.find((p) => p.hasLust)?.name ?? 'None';

  const fields: EmbedField[] = [
    { name: 'Tank', value: tankName },
    { name: 'Healer', value: healerName },
    { name: 'DPS', value: `${dps1Name}, ${dps2Name}, ${dps3Name}` },
    { name: 'Battle Res', value: brezPlayer, inline: true },
    { name: 'Bloodlust', value: lustPlayer, inline: true },
  ];

  const inviteCmd = generateInviteCommand(group.toDict());
  if (inviteCmd) {
    fields.push({ name: 'Invite Command', value: `\`${inviteCmd}\`` });
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
    const tankName = group.tank?.name ?? PLACEHOLDER_CHAR;
    const healerName = group.healer?.name ?? PLACEHOLDER_CHAR;
    const dps1Name = group.dps.length > 0 ? group.dps[0].name : PLACEHOLDER_CHAR;
    const dps2Name = group.dps.length > 1 ? group.dps[1].name : PLACEHOLDER_CHAR;
    const dps3Name = group.dps.length > 2 ? group.dps[2].name : PLACEHOLDER_CHAR;

    const allPlayers = group.players;
    const brezPlayer = allPlayers.find((p) => p.hasBrez)?.name ?? 'None';
    const lustPlayer = allPlayers.find((p) => p.hasLust)?.name ?? 'None';

    const embed: Embed = {
      title: `Group ${groupNumber}`,
      color: GOLD,
      fields: [
        { name: 'Tank', value: getMaskedName(tankName) },
        { name: 'Healer', value: getMaskedName(healerName) },
        {
          name: 'DPS',
          value: `${getMaskedName(dps1Name)}, ${getMaskedName(dps2Name)}, ${getMaskedName(dps3Name)}`,
        },
        { name: 'Battle Res', value: getMaskedName(brezPlayer), inline: true },
        { name: 'Bloodlust', value: getMaskedName(lustPlayer), inline: true },
      ],
    };

    let embedMessage = await ctx.send({ embed });
    embedMessage = await animateUpdate(
      embedMessage, channel, embed, 0, 'Tank', tankName, debug,
    );
    embedMessage = await animateUpdate(
      embedMessage, channel, embed, 1, 'Healer', healerName, debug,
    );
    embedMessage = await animateUpdate(
      embedMessage, channel, embed, 2, 'DPS',
      `${dps1Name}, ${getMaskedName(dps2Name)}, ${getMaskedName(dps3Name)}`, debug,
    );
    embedMessage = await animateUpdate(
      embedMessage, channel, embed, 2, 'DPS',
      `${dps1Name}, ${dps2Name}, ${getMaskedName(dps3Name)}`, debug,
    );
    embedMessage = await animateUpdate(
      embedMessage, channel, embed, 2, 'DPS',
      `${dps1Name}, ${dps2Name}, ${dps3Name}`, debug,
    );
    embedMessage = await embedMessage.edit({
      embed: setFieldAt(embed, 3, 'Battle Res', brezPlayer),
    });
    await embedMessage.edit({
      embed: setFieldAt(embed, 4, 'Bloodlust', lustPlayer),
    });
  }
}
