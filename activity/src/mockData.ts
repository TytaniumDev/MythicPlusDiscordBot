import { Session, WoWGroup, WoWPlayer } from './types';

export const mockPlayers: WoWPlayer[] = [
  // 1. Martz: Healer, Tank Offspec, DPS Offspec, Brez
  {
    name: 'Martz',
    roles: {
      tankMain: false,
      healerMain: true,
      dpsMain: false,
      offtank: true,
      offhealer: false,
      offdps: true,
      ranged: false,
      melee: false,
      hasBrez: true,
      hasLust: false
    }
  },
  // 2. KingofSkillz: DPS, Ranged, Lust
  {
    name: 'KingofSkillz',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 3. chaoswaffles: DPS, Tank Offspec
  {
    name: 'chaoswaffles',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: true,
      offhealer: false,
      offdps: false,
      ranged: false,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 4. Upartyhardy: DPS, Ranged
  {
    name: 'Upartyhardy',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 5. Pandemonium: Tank, DPS Offspec, Brez
  {
    name: 'Pandemonium',
    roles: {
      tankMain: true,
      healerMain: false,
      dpsMain: false,
      offtank: false,
      offhealer: false,
      offdps: true,
      ranged: false,
      melee: false,
      hasBrez: true,
      hasLust: false
    }
  },
  // 6. Will: DPS
  {
    name: 'Will',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: false,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 7. Tytanium: DPS, Healer Offspec, Ranged, Lust
  {
    name: 'Tytanium',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: true,
      offdps: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 8. hammer13: DPS
  {
    name: 'hammer13',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: false,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 9. Ultra9: DPS, Ranged, Lust
  {
    name: 'Ultra9',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 10. DrZoidberg: DPS, Ranged
  {
    name: 'DrZoidberg',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: true,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 11. Player1x: DPS, Healer Offspec, Lust
  {
    name: 'Player1x',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: true,
      offdps: false,
      ranged: false,
      melee: false,
      hasBrez: false,
      hasLust: true
    }
  },
  // 12. lizardtotem: Healer, DPS Offspec
  {
    name: 'lizardtotem',
    roles: {
      tankMain: false,
      healerMain: true,
      dpsMain: false,
      offtank: false,
      offhealer: false,
      offdps: true,
      ranged: false,
      melee: false,
      hasBrez: false,
      hasLust: false
    }
  },
  // 13. rorschach128: DPS
  {
    name: 'rorschach128',
    roles: {
      tankMain: false,
      healerMain: false,
      dpsMain: true,
      offtank: false,
      offhealer: false,
      offdps: false,
      ranged: false,
      melee: false,
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
      mockPlayers[1], // KingofSkillz (DPS, Ranged, Lust)
      mockPlayers[3], // Upartyhardy (DPS, Ranged)
      mockPlayers[8]  // Ultra9 (DPS, Ranged, Lust)
    ]
  },
  {
    tank: mockPlayers[2], // chaoswaffles (Tank Offspec)
    healer: mockPlayers[11], // lizardtotem (Healer)
    dps: [
      mockPlayers[6], // Tytanium (DPS, Ranged, Lust)
      mockPlayers[9], // DrZoidberg (DPS, Ranged)
      mockPlayers[5]  // Will (DPS)
    ]
  },
  {
    tank: null,
    healer: null,
    dps: [
      mockPlayers[7],  // hammer13 (DPS)
      mockPlayers[10], // Player1x (DPS, Healer Offspec, Lust)
      mockPlayers[12]  // rorschach128 (DPS)
    ]
  }
];

export const mockSession: Session = {
  guildId: 'demo-guild',
  guildName: 'Gif or Gif',
  status: 'lobby',
  players: [], // Initially empty until channel selected
  groups: [], // Initially empty
  voiceChannels: [
    { id: 'vc-1', name: 'Mythic+ Lobby', userCount: 13 },
    { id: 'vc-2', name: 'Raid Voice', userCount: 5 },
    { id: 'vc-3', name: 'AFK', userCount: 1 },
  ],
  selectedChannelId: null, // Start with picker
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
};
