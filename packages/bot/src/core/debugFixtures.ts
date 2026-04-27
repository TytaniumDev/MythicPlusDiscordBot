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
  WoWPlayer,
} from '@mythicplus/shared';

export function getDebugPlayers(): WoWPlayer[] {
  // Classes are assigned to match each player's role/utility combination
  // (e.g. brez classes for the brez carriers, lust classes for the lusters)
  // so debug-mode wheels render real class colors instead of the null fallback.
  return [
    WoWPlayer.create('Martz', [ROLE_HEALER, ROLE_TANK_OFFSPEC, ROLE_MELEE_OFFSPEC, ROLE_BREZ], '', '', null, 'Druid'),
    WoWPlayer.create('KingofSkillz', [ROLE_RANGED, ROLE_LUST], '', '', null, 'Mage'),
    WoWPlayer.create('chaoswaffles', [ROLE_MELEE, ROLE_TANK_OFFSPEC], '', '', null, 'Death Knight'),
    WoWPlayer.create('Upartyhardy', [ROLE_RANGED], '', '', null, 'Hunter'),
    WoWPlayer.create('Pandemonium', [ROLE_TANK, ROLE_MELEE_OFFSPEC, ROLE_BREZ], '', '', null, 'Death Knight'),
    WoWPlayer.create('Will', [ROLE_MELEE], '', '', null, 'Rogue'),
    WoWPlayer.create('Tytanium', [ROLE_RANGED, ROLE_HEALER_OFFSPEC, ROLE_LUST], '', '', null, 'Shaman'),
    WoWPlayer.create('hammer13', [ROLE_MELEE], '', '', null, 'Demon Hunter'),
    WoWPlayer.create('Ultra9', [ROLE_RANGED, ROLE_LUST], '', '', null, 'Mage'),
    WoWPlayer.create('DrZoidberg', [ROLE_RANGED], '', '', null, 'Warlock'),
    WoWPlayer.create('Player1x', [ROLE_RANGED, ROLE_HEALER_OFFSPEC, ROLE_LUST], '', '', null, 'Evoker'),
    WoWPlayer.create('lizardtotem', [ROLE_HEALER, ROLE_MELEE_OFFSPEC], '', '', null, 'Shaman'),
    WoWPlayer.create('rorschach128', [ROLE_MELEE], '', '', null, 'Monk'),
  ];
}
