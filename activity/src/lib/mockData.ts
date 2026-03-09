import { GuildData, ChannelData, WoWGroup, WoWPlayer } from '../types';

export const mockPlayers: WoWPlayer[] = [
  // 1. Martz: Healer, Tank Offspec, Melee Offspec, Brez
  {
    name: 'Martz',
    discordId: '100000000000000001',
    mainRole: 'healer',
    offspecs: ['tank', 'melee'],
    utilities: ['brez'],
  },
  // 2. KingofSkillz: Ranged, Lust
  {
    name: 'KingofSkillz',
    discordId: '100000000000000002',
    mainRole: 'ranged',
    offspecs: [],
    utilities: ['lust'],
  },
  // 3. chaoswaffles: Melee, Tank Offspec
  {
    name: 'chaoswaffles',
    discordId: '100000000000000003',
    mainRole: 'melee',
    offspecs: ['tank'],
    utilities: [],
  },
  // 4. Upartyhardy: Ranged
  {
    name: 'Upartyhardy',
    discordId: '100000000000000004',
    mainRole: 'ranged',
    offspecs: [],
    utilities: [],
  },
  // 5. Pandemonium: Tank, Melee Offspec, Brez
  {
    name: 'Pandemonium',
    discordId: '100000000000000005',
    mainRole: 'tank',
    offspecs: ['melee'],
    utilities: ['brez'],
  },
  // 6. Will: Melee
  {
    name: 'Will',
    discordId: '100000000000000006',
    mainRole: 'melee',
    offspecs: [],
    utilities: [],
  },
  // 7. Tytanium: Ranged, Healer Offspec, Lust
  {
    name: 'Tytanium',
    discordId: '100000000000000007',
    mainRole: 'ranged',
    offspecs: ['healer'],
    utilities: ['lust'],
  },
  // 8. hammer13: Melee
  {
    name: 'hammer13',
    discordId: '100000000000000008',
    mainRole: 'melee',
    offspecs: [],
    utilities: [],
  },
  // 9. Ultra9: Ranged, Lust
  {
    name: 'Ultra9',
    discordId: '100000000000000009',
    mainRole: 'ranged',
    offspecs: [],
    utilities: ['lust'],
  },
  // 10. DrZoidberg: Ranged
  {
    name: 'DrZoidberg',
    discordId: '100000000000000010',
    mainRole: 'ranged',
    offspecs: [],
    utilities: [],
  },
  // 11. Player1x: Ranged, Healer Offspec, Lust
  {
    name: 'Player1x',
    discordId: '100000000000000011',
    mainRole: 'ranged',
    offspecs: ['healer'],
    utilities: ['lust'],
  },
  // 12. lizardtotem: Healer, Melee Offspec
  {
    name: 'lizardtotem',
    discordId: '100000000000000012',
    mainRole: 'healer',
    offspecs: ['melee'],
    utilities: [],
  },
  // 13. rorschach128: Melee
  {
    name: 'rorschach128',
    discordId: '100000000000000013',
    mainRole: 'melee',
    offspecs: [],
    utilities: [],
  },
];

export const mockGroups: WoWGroup[] = [
  {
    tank: mockPlayers[4], // Pandemonium (Tank)
    healer: mockPlayers[0], // Martz (Healer)
    dps: [
      mockPlayers[1], // KingofSkillz (Ranged, Lust)
      mockPlayers[3], // Upartyhardy (Ranged)
      mockPlayers[8],  // Ultra9 (Ranged, Lust)
    ],
  },
  {
    tank: mockPlayers[2], // chaoswaffles (Tank Offspec)
    healer: mockPlayers[11], // lizardtotem (Healer)
    dps: [
      mockPlayers[6], // Tytanium (Ranged, Lust)
      mockPlayers[9], // DrZoidberg (Ranged)
      mockPlayers[5],  // Will (Melee)
    ],
  },
  {
    tank: null,
    healer: null,
    dps: [
      mockPlayers[7],  // hammer13 (Melee)
      mockPlayers[10], // Player1x (Ranged, Healer Offspec, Lust)
      mockPlayers[12],  // rorschach128 (Melee)
    ],
  },
];

export const mockGuildData: GuildData = {
  guildId: 'demo-guild',
  guildName: 'Gif or Gif',
  voiceChannels: [
    { id: 'vc-1', name: 'Mythic+ Lobby', userCount: 13 },
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
  announceResults: true,
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
  lastActive: { seconds: Date.now() / 1000, nanoseconds: 0 },
};
