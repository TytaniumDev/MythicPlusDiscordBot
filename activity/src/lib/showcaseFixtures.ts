import type { WoWGroup, WoWPlayer } from '../types';

// Reuse the five real character renders from the SpotlightPortraits stories
// so story screenshots show actual armory images during wheel/results flows.
// `inGameName` ties each avatar to the real Raider.io character whose render
// it shows — that lets `useDungeonSuggestions` pull live M+ scores for
// showcase fixtures (e.g. the Storybook ResultsView story) instead of
// rendering an empty panel.
const AVATARS = {
  druidTank: {
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/0/172476416-inset.jpg',
    characterClass: 'Druid',
    inGameName: 'Gazzi-Uldum',
  },
  priestHealer: {
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/23/175701015-inset.jpg',
    characterClass: 'Priest',
    inGameName: 'Sorovar-Uldum',
  },
  hunterRanged: {
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    characterClass: 'Hunter',
    inGameName: 'Tytaniormu-Uldum',
  },
  druidRanged: {
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/32/173283360-inset.jpg',
    characterClass: 'Druid',
    inGameName: 'Quill-Uldum',
  },
  dhMelee: {
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/228/184072932-inset.jpg',
    characterClass: 'Demon Hunter',
    inGameName: 'Vanyali-Hyjal',
  },
} as const;

function player(
  name: string,
  discordId: string,
  mainRole: WoWPlayer['mainRole'],
  avatar: { mediaUrl: string; characterClass: string; inGameName: string },
  extras: Partial<Pick<WoWPlayer, 'offspecs' | 'utilities'>> = {},
): WoWPlayer {
  return {
    name,
    discordId,
    inGameName: avatar.inGameName,
    mainRole,
    offspecs: extras.offspecs ?? [],
    utilities: extras.utilities ?? [],
    mediaUrl: avatar.mediaUrl,
    characterClass: avatar.characterClass as WoWPlayer['characterClass'],
  };
}

// Group 1 — the five originals from the SpotlightPortraits stories.
const gazzi = player('Gazzi', 'p01', 'tank', AVATARS.druidTank, { utilities: ['brez'] });
const sorovar = player('Sorovar', 'p02', 'healer', AVATARS.priestHealer);
const tytaniormu = player('Tytaniormu', 'p03', 'ranged', AVATARS.hunterRanged, { utilities: ['brez', 'lust'] });
const quill = player('Quill', 'p04', 'ranged', AVATARS.druidRanged);
const blueshift = player('Blueshift', 'p05', 'melee', AVATARS.dhMelee);

// Group 2 — fresh names with the same five avatars cycled so both showcase
// cards read as real characters even though only five renders exist.
const thornroot = player('Thornroot', 'p06', 'tank', AVATARS.druidTank, { utilities: ['brez'] });
const vestra = player('Vestra', 'p07', 'healer', AVATARS.priestHealer);
const kaelith = player('Kaelith', 'p08', 'ranged', AVATARS.hunterRanged, { utilities: ['lust'] });
const moonspark = player('Moonspark', 'p09', 'ranged', AVATARS.druidRanged);
const duskrender = player('Duskrender', 'p10', 'melee', AVATARS.dhMelee);

// Remainder — leftover melee/ranged reusing the DH + hunter renders.
const crowfall = player('Crowfall', 'p11', 'melee', AVATARS.dhMelee);
const sablesong = player('Sablesong', 'p12', 'ranged', AVATARS.hunterRanged, { utilities: ['lust'] });
const ironroot = player('Ironroot', 'p13', 'melee', AVATARS.dhMelee);

export const showcasePlayers: WoWPlayer[] = [
  gazzi, sorovar, tytaniormu, quill, blueshift,
  thornroot, vestra, kaelith, moonspark, duskrender,
  crowfall, sablesong, ironroot,
];

export const showcaseGroups: WoWGroup[] = [
  { tank: gazzi, healer: sorovar, dps: [tytaniormu, quill, blueshift] },
  { tank: thornroot, healer: vestra, dps: [kaelith, moonspark, duskrender] },
  { tank: null, healer: null, dps: [crowfall, sablesong, ironroot] },
];

/** Discord ID of a player inside group 2, convenient for "Your Group" demos. */
export const SHOWCASE_CURRENT_PLAYER_ID = 'p08'; // Kaelith
