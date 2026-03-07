import { GuildData, ChannelData, WoWGroup, WoWPlayer } from './types';

export const mockPlayers: WoWPlayer[] = [
  // 1. Martz: Healer, Tank Offspec, Melee Offspec, Brez
  {
    name: 'Martz',
    roles: {
      tankMain: false,
      healerMain: true,
      dpsMain: false,
      offtank: true,
      offhealer: false,
      offdps: true,
      offranged: false,
      offmelee: true,
      ranged: false,
      melee: false,
      hasBrez: true,
      hasLust: false
    }
  },
  // 2. KingofSkillz: Ranged, Lust
  {
    name: 'KingofSkillz',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 3. chaoswaffles: Melee, Tank Offspec
  {
    name: 'chaoswaffles',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: true,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: false,
      melee: true,
      hasBrez: false,
      hasLust: false
    }
  },
  // 4. Upartyhardy: Ranged
  {
    name: 'Upartyhardy',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 5. Pandemonium: Tank, Melee Offspec, Brez
  {
    name: 'Pandemonium',
    roles: {
      tankMain: true,
      healerMain: false,
      dpsMain: false,
      offtank: false,
      offhealer: false,
      offdps: true,
      offranged: false,
      offmelee: true,
      ranged: false,
      melee: false,
      hasBrez: true,
      hasLust: false
    }
  },
  // 6. Will: Melee
  {
    name: 'Will',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: false,
      melee: true,
      hasBrez: false,
      hasLust: false
    }
  },
  // 7. Tytanium: Ranged, Healer Offspec, Lust
  {
    name: 'Tytanium',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: true,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 8. hammer13: Melee
  {
    name: 'hammer13',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: false,
      melee: true,
      hasBrez: false,
      hasLust: false
    }
  },
  // 9. Ultra9: Ranged, Lust
  {
    name: 'Ultra9',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 10. DrZoidberg: Ranged
  {
    name: 'DrZoidberg',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 11. Player1x: Ranged, Healer Offspec, Lust
  {
    name: 'Player1x',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: true,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 12. lizardtotem: Healer, Melee Offspec
  {
    name: 'lizardtotem',
    roles: {
      tankMain: false,
      healerMain: true,
      dpsMain: false,
      offtank: false,
      offhealer: false,
      offdps: true,
      offranged: false,
      offmelee: true,
      ranged: false,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 13. rorschach128: Melee
  {
    name: 'rorschach128',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      offranged: false,
      offmelee: false,
      ranged: false,
      melee: true,
      hasBrez: false,
      hasLust: false
    }
  }
];

export const mockGroups: WoWGroup[] = [
  {
    tank: mockPlayers[4], // Pandemonium (Tank)
    healer: mockPlayers[0], // Martz (Healer)
    dps: [
      mockPlayers[1], // KingofSkillz (Ranged, Lust)
      mockPlayers[3], // Upartyhardy (Ranged)
      mockPlayers[8]  // Ultra9 (Ranged, Lust)
    ]
  },
  {
    tank: mockPlayers[2], // chaoswaffles (Tank Offspec)
    healer: mockPlayers[11], // lizardtotem (Healer)
    dps: [
      mockPlayers[6], // Tytanium (Ranged, Lust)
      mockPlayers[9], // DrZoidberg (Ranged)
      mockPlayers[5]  // Will (Melee)
    ]
  },
  {
    tank: null,
    healer: null,
    dps: [
      mockPlayers[7],  // hammer13 (Melee)
      mockPlayers[10], // Player1x (Ranged, Healer Offspec, Lust)
      mockPlayers[12]  // rorschach128 (Melee)
    ]
  }
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
