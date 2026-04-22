import { GuildData, ChannelData, WoWGroup, WoWPlayer } from '../types';

// Real characters sampled from the production Firestore `preferences` pool,
// with Discord IDs anonymized. Media URLs point at Battle.net's CDN and are
// stable across the season. Indices are load-bearing for Storybook stories
// and Playwright tests — see grep "mockPlayers\[" before reordering:
//   [0]  healer archetype with offspecs     (PlayerCard/EditPlayerModal/MobilePlayerDrawer stories)
//   [4]  tank with inGameName               (lobbyIdentity in visual/pages/a11y/roleEditor tests)
//   [5]  sit-out target                     (visual/pages tests)
//   [6]  currentUser with inGameName        (RoleEditor.CurrentUser, EditPlayerModal.CurrentUser)
//   [7]  sit-out target                     (visual/pages tests)
//   [11] healer                             (mockGroups[1].healer)
export const mockPlayers: WoWPlayer[] = [
  // 1. Quill: Healer Druid, full offspec coverage + Brez
  {
    name: 'Quill',
    discordId: '100000000000000001',
    inGameName: 'Quill-Uldum',
    mainRole: 'healer',
    offspecs: ['tank', 'ranged', 'melee'],
    utilities: ['brez'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/32/173283360-inset.jpg',
    characterClass: 'Druid',
  },
  // 2. Schmeebs: Ranged Mage, Brez
  {
    name: 'Schmeebs',
    discordId: '100000000000000002',
    inGameName: 'Schmeebs-Area 52',
    mainRole: 'ranged',
    offspecs: [],
    utilities: ['brez'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/area-52/17/178813457-inset.jpg',
    characterClass: 'Mage',
  },
  // 3. Kitchenstink: Melee Warrior, Tank Offspec
  {
    name: 'Kitchenstink',
    discordId: '100000000000000003',
    inGameName: 'Kitchenstink-Uldum',
    mainRole: 'melee',
    offspecs: ['tank'],
    utilities: [],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/14/173973262-inset.jpg',
    characterClass: 'Warrior',
  },
  // 4. Vanyali: Ranged Demon Hunter
  {
    name: 'Vanyali',
    discordId: '100000000000000004',
    inGameName: 'Vanyali-Hyjal',
    mainRole: 'ranged',
    offspecs: [],
    utilities: [],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/hyjal/47/160044335-inset.jpg',
    characterClass: 'Demon Hunter',
  },
  // 5. Gazzi: Tank Druid, Brez
  {
    name: 'Gazzi',
    discordId: '100000000000000005',
    inGameName: 'Gazzi-Uldum',
    mainRole: 'tank',
    offspecs: [],
    utilities: ['brez'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/0/172476416-inset.jpg',
    characterClass: 'Druid',
  },
  // 6. Mickey: Melee Monk
  {
    name: 'Mickey',
    discordId: '100000000000000006',
    inGameName: 'Mickey-Eitrigg',
    mainRole: 'melee',
    offspecs: [],
    utilities: [],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/eitrigg/223/120199135-inset.jpg',
    characterClass: 'Monk',
  },
  // 7. Fourseven: Ranged Mage, Lust (CurrentUser archetype)
  {
    name: 'Fourseven',
    discordId: '100000000000000007',
    inGameName: 'Fourseven-Stormrage',
    mainRole: 'ranged',
    offspecs: [],
    utilities: ['lust'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/31/256146207-inset.jpg',
    characterClass: 'Mage',
  },
  // 8. Jonjee: Melee Paladin, Tank Offspec, Brez
  {
    name: 'Jonjee',
    discordId: '100000000000000008',
    inGameName: 'Jonjee-Uldum',
    mainRole: 'melee',
    offspecs: ['tank'],
    utilities: ['brez'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/69/175929413-inset.jpg',
    characterClass: 'Paladin',
  },
  // 9. Volkareth: Ranged Evoker, Lust
  {
    name: 'Volkareth',
    discordId: '100000000000000009',
    inGameName: 'Volkareth-Uldum',
    mainRole: 'ranged',
    offspecs: [],
    utilities: ['lust'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/35/174078755-inset.jpg',
    characterClass: 'Evoker',
  },
  // 10. Khurri: Melee Druid, Melee Offspec duplicate trims — Brez
  {
    name: 'Khurri',
    discordId: '100000000000000010',
    inGameName: 'Khurri-Uldum',
    mainRole: 'melee',
    offspecs: [],
    utilities: ['brez'],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/94/177397086-inset.jpg',
    characterClass: 'Druid',
  },
  // 11. Temma: Tank Warrior, Melee Offspec
  {
    name: 'Temma',
    discordId: '100000000000000011',
    inGameName: 'Temma-Uldum',
    mainRole: 'tank',
    offspecs: ['melee'],
    utilities: [],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/204/182662860-inset.jpg',
    characterClass: 'Warrior',
  },
  // 12. Sorovar: Healer Priest, Ranged Offspec
  {
    name: 'Sorovar',
    discordId: '100000000000000012',
    inGameName: 'Sorovar-Uldum',
    mainRole: 'healer',
    offspecs: ['ranged'],
    utilities: [],
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/23/175701015-inset.jpg',
    characterClass: 'Priest',
  },
];

export const mockGroups: WoWGroup[] = [
  {
    tank: mockPlayers[4], // Gazzi (Tank, Brez)
    healer: mockPlayers[0], // Quill (Healer, Brez)
    dps: [
      mockPlayers[1], // Schmeebs (Ranged, Brez)
      mockPlayers[2], // Kitchenstink (Melee, Tank Offspec)
      mockPlayers[8], // Volkareth (Ranged, Lust)
    ],
  },
  {
    tank: mockPlayers[10], // Temma (Tank)
    healer: mockPlayers[11], // Sorovar (Healer)
    dps: [
      mockPlayers[7], // Jonjee (Melee, Brez)
      mockPlayers[6], // Fourseven (Ranged, Lust)
      mockPlayers[3], // Vanyali (Ranged)
    ],
  },
  {
    tank: null,
    healer: null,
    dps: [
      mockPlayers[5], // Mickey (Melee)
      mockPlayers[9], // Khurri (Melee, Brez)
    ],
  },
];

export const mockGuildData: GuildData = {
  guildId: 'demo-guild',
  guildName: 'Gif or Gif',
  voiceChannels: [
    { id: 'vc-1', name: 'Mythic+ Lobby', userCount: 12 },
    { id: 'vc-2', name: 'Raid Voice', userCount: 5 },
    { id: 'vc-3', name: 'AFK', userCount: 1 },
  ],
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
  lastActive: { seconds: Date.now() / 1000, nanoseconds: 0 },
};

export const mockChannelData: ChannelData = {
  channelId: 'vc-1',
  channelName: 'Mythic+ Lobby',
  guildId: 'demo-guild',
  status: 'lobby',
  players: mockPlayers,
  groups: [],
  revealedGroups: 0,
  isDebug: false,
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
  lastActive: { seconds: Date.now() / 1000, nanoseconds: 0 },
};
