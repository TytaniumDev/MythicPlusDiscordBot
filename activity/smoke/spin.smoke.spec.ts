import { test, expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  ROLE_BREZ,
  ROLE_HEALER,
  ROLE_LUST,
  ROLE_MELEE,
  ROLE_MELEE_OFFSPEC,
  ROLE_RANGED,
  ROLE_TANK,
  ROLE_TANK_OFFSPEC,
  WoWGroup,
  WoWPlayer,
  bumpPairCounts,
  decodeGroupHistoryRounds,
  todayPST,
  type CharacterClass,
  type Role,
  type WoWGroupDict,
  type WoWPlayerDict,
} from '@mythicplus/shared';
import { mockCharacterRenders } from '../tests/helpers/renders';
import { mockRaiderio } from '../tests/helpers/raiderio';

// The admin SDK talks to the emulator via FIRESTORE_EMULATOR_HOST and bypasses
// security rules — the same privileges the bot has. The browser goes through
// the client SDK, so its writes are checked against firestore.rules.
if (getApps().length === 0) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

const GUILD_ID = '900000000000000001';
const CHANNEL_ID = '900000000000000002';
const SEASON_SLUG = 'smoke-season';

function player(
  id: number,
  name: string,
  roles: string[],
  characterClass: CharacterClass,
): WoWPlayer {
  const mediaUrl = `https://render.worldofwarcraft.com/us/character/stormrage/1/${id}-avatar.jpg`;
  return WoWPlayer.create(name, roles, String(id), `${name}-Stormrage`, mediaUrl, characterClass);
}

// 2 tanks, 2 healers, 6 DPS: exactly two full groups.
const ROSTER = [
  player(1001, 'Tankone', [ROLE_TANK, ROLE_BREZ], 'Death Knight'),
  player(1002, 'Tanktwo', [ROLE_TANK, ROLE_MELEE_OFFSPEC], 'Warrior'),
  player(1003, 'Healone', [ROLE_HEALER, ROLE_BREZ], 'Druid'),
  player(1004, 'Healtwo', [ROLE_HEALER, ROLE_LUST], 'Shaman'),
  player(1005, 'Rangeone', [ROLE_RANGED, ROLE_LUST], 'Mage'),
  player(1006, 'Rangetwo', [ROLE_RANGED], 'Hunter'),
  player(1007, 'Rangethree', [ROLE_RANGED, ROLE_BREZ], 'Warlock'),
  player(1008, 'Meleeone', [ROLE_MELEE], 'Rogue'),
  player(1009, 'Meleetwo', [ROLE_MELEE, ROLE_TANK_OFFSPEC], 'Paladin'),
  player(1010, 'Meleethree', [ROLE_MELEE], 'Monk'),
];

/** Write what the bot and Cloud Functions would have: config, guild, and a lobby. */
async function seedLobby(): Promise<void> {
  const now = FieldValue.serverTimestamp();
  await db.doc('config/season').set({ slug: SEASON_SLUG, blizzardSeasonId: 1, expansionId: 11 });
  await db.doc(`guilds/${GUILD_ID}`).set({
    guildId: GUILD_ID,
    guildName: 'Smoke Test Guild',
    voiceChannels: [{ id: CHANNEL_ID, name: 'Mythic+ Lobby', userCount: ROSTER.length }],
    createdAt: now,
    lastActive: now,
  });
  await db.doc(`channels/${CHANNEL_ID}`).set({
    channelId: CHANNEL_ID,
    channelName: 'Mythic+ Lobby',
    guildId: GUILD_ID,
    status: 'lobby',
    players: ROSTER.map((p) => p.toDict()),
    groups: [],
    sittingOut: [],
    isDebug: false,
    createdAt: now,
    lastActive: now,
  });
}

function canPlay(p: WoWPlayerDict, role: Role): boolean {
  return p.mainRole === role || p.offspecs.includes(role);
}

/** Every player placed exactly once, two full groups, everyone in a slot they can play. */
function expectValidGroups(groups: WoWGroupDict[]): void {
  const placed = groups.flatMap((g) => [g.tank, g.healer, ...g.dps].filter((p) => p !== null));
  expect(placed.map((p) => p.discordId).sort()).toEqual(ROSTER.map((p) => p.discordId).sort());

  const full = groups.filter((g) => g.tank && g.healer && g.dps.length === 3);
  expect(full).toHaveLength(2);

  for (const g of groups) {
    if (g.tank) expect(canPlay(g.tank, 'tank'), `${g.tank.name} in tank slot`).toBe(true);
    if (g.healer) expect(canPlay(g.healer, 'healer'), `${g.healer.name} in healer slot`).toBe(true);
    for (const d of g.dps) {
      expect(canPlay(d, 'ranged') || canPlay(d, 'melee'), `${d.name} in dps slot`).toBe(true);
    }
  }
}

/** From the lobby, run a spin the way the guild leader does and wait for the result. */
async function spinFromLobby(page: Page): Promise<WoWGroupDict[]> {
  await page.locator('#spin-btn').click();
  await expect(page.locator('#view-wheels')).toBeVisible();
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.locator('#view-results')).toBeVisible({ timeout: 60_000 });

  const channel = db.doc(`channels/${CHANNEL_ID}`);
  await expect.poll(async () => (await channel.get()).get('status')).toBe('completed');
  const groups = (await channel.get()).get('groups') as WoWGroupDict[];
  expectValidGroups(groups);
  return groups;
}

async function readGuild(): Promise<{ rounds: WoWGroupDict[][]; date: unknown; seasonPairs: unknown }> {
  const guild = (await db.doc(`guilds/${GUILD_ID}`).get()).data() ?? {};
  const history = guild.groupHistory as { date?: string; rounds?: unknown[] } | undefined;
  return {
    date: history?.date,
    rounds: decodeGroupHistoryRounds(history?.rounds ?? []),
    seasonPairs: guild.seasonPairs,
  };
}

function toGroups(dicts: WoWGroupDict[]): WoWGroup[] {
  return dicts.map((g) => WoWGroup.fromDict(g));
}

test('a lobby spins into valid groups, and history carries into the next round', async ({ page }) => {
  await mockCharacterRenders(page);
  await mockRaiderio(page);
  await seedLobby();

  await test.step('join as a player', async () => {
    await page.goto(`/?guildId=${GUILD_ID}&channelId=${CHANNEL_ID}`);
    await page.getByRole('button', { name: 'Select Tankone' }).click();
    await page.locator('#identity-continue-btn').click();
    await page.locator('#setup-ready-btn').click();
    await expect(page.locator('#view-lobby')).toBeVisible();
  });

  const round1 = await test.step('first spin forms valid groups', () => spinFromLobby(page));

  await test.step('history and season pairs are saved', async () => {
    const guild = await readGuild();
    expect(guild.date).toBe(todayPST());
    expect(guild.rounds).toEqual([round1]);
    expect(guild.seasonPairs).toEqual({
      seasonSlug: SEASON_SLUG,
      counts: bumpPairCounts({}, toGroups(round1)),
    });
  });

  await test.step('start a new round', async () => {
    await page.locator('#new-round-btn').click();
    await expect(page.locator('#view-lobby')).toBeVisible();
    await expect.poll(async () => (await db.doc(`channels/${CHANNEL_ID}`).get()).get('status')).toBe('lobby');
  });

  const round2 = await test.step('second spin forms valid groups', () => spinFromLobby(page));

  await test.step('history now holds both rounds', async () => {
    const guild = await readGuild();
    expect(guild.date).toBe(todayPST());
    expect(guild.rounds).toEqual([round1, round2]);
    expect(guild.seasonPairs).toEqual({
      seasonSlug: SEASON_SLUG,
      counts: bumpPairCounts(bumpPairCounts({}, toGroups(round1)), toGroups(round2)),
    });
  });
});
