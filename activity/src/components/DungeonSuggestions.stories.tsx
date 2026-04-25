import type { Meta, StoryObj } from '@storybook/react-vite';
import { DungeonSuggestions } from './DungeonSuggestions';
import type { DungeonSuggestion } from '../lib/dungeonSuggestions';

const ICONS = {
  flood: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_waterworks.jpg',
  eda: 'https://cdn.raiderio.net/images/wow/icons/large/inv_112_achievement_dungeon_ecodome.jpg',
  arak: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_arak-ara.jpg',
  dawn: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_dawnbreaker.jpg',
  psf: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_prioryofthesacredflame.jpg',
  hoa: 'https://cdn.raiderio.net/images/wow/icons/large/achievement_dungeon_hallsofattonement.jpg',
  strt: 'https://cdn.raiderio.net/images/wow/icons/large/achievement_dungeon_brokerdungeon.jpg',
  gmbt: 'https://cdn.raiderio.net/images/wow/icons/large/achievement_dungeon_theotherside_dealergexa.jpg',
} as const;

const sampleRanking: DungeonSuggestion[] = [
  { challengeModeId: 525, name: 'Operation: Floodgate', shortName: 'FLOOD', iconUrl: ICONS.flood, totalScore: 412, playersWithRuns: 3, avgLevel: 9.3 },
  { challengeModeId: 542, name: "Eco-Dome Al'dani", shortName: 'EDA', iconUrl: ICONS.eda, totalScore: 558, playersWithRuns: 4, avgLevel: 10.5 },
  { challengeModeId: 503, name: 'Ara-Kara, City of Echoes', shortName: 'ARAK', iconUrl: ICONS.arak, totalScore: 691, playersWithRuns: 5, avgLevel: 11.2 },
  { challengeModeId: 505, name: 'The Dawnbreaker', shortName: 'DAWN', iconUrl: ICONS.dawn, totalScore: 740, playersWithRuns: 5, avgLevel: 11.6 },
  { challengeModeId: 499, name: 'Priory of the Sacred Flame', shortName: 'PSF', iconUrl: ICONS.psf, totalScore: 802, playersWithRuns: 5, avgLevel: 12.0 },
  { challengeModeId: 378, name: 'Halls of Atonement', shortName: 'HOA', iconUrl: ICONS.hoa, totalScore: 855, playersWithRuns: 5, avgLevel: 12.4 },
  { challengeModeId: 391, name: 'Tazavesh: Streets of Wonder', shortName: 'STRT', iconUrl: ICONS.strt, totalScore: 902, playersWithRuns: 5, avgLevel: 12.8 },
  { challengeModeId: 392, name: "Tazavesh: So'leah's Gambit", shortName: 'GMBT', iconUrl: ICONS.gmbt, totalScore: 951, playersWithRuns: 5, avgLevel: 13.0 },
];

const meta = {
  title: 'Molecules/DungeonSuggestions',
  component: DungeonSuggestions,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DungeonSuggestions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {
    status: 'ready',
    ranking: sampleRanking,
    characterCount: 5,
    lookupTargetCount: 5,
  },
};

export const ReadyHorizontal: Story = {
  parameters: { layout: 'padded' },
  args: {
    status: 'ready',
    ranking: sampleRanking,
    characterCount: 5,
    lookupTargetCount: 5,
    layout: 'horizontal',
  },
};

export const LoadingHorizontal: Story = {
  parameters: { layout: 'padded' },
  args: {
    status: 'loading',
    ranking: [],
    characterCount: 0,
    lookupTargetCount: 5,
    layout: 'horizontal',
  },
};

export const Loading: Story = {
  args: {
    status: 'loading',
    ranking: [],
    characterCount: 0,
    lookupTargetCount: 5,
  },
};

export const Idle: Story = {
  args: {
    status: 'idle',
    ranking: [],
    characterCount: 0,
    lookupTargetCount: 0,
  },
};

export const Empty: Story = {
  args: {
    status: 'empty',
    ranking: [],
    characterCount: 0,
    lookupTargetCount: 0,
  },
};

export const EmptyNoRuns: Story = {
  args: {
    status: 'empty',
    ranking: [],
    characterCount: 0,
    lookupTargetCount: 5,
  },
};

export const Error: Story = {
  args: {
    status: 'error',
    ranking: [],
    characterCount: 0,
    lookupTargetCount: 5,
  },
};

export const SinglePlayer: Story = {
  args: {
    status: 'ready',
    ranking: sampleRanking.slice(0, 3),
    characterCount: 1,
    lookupTargetCount: 1,
  },
};

export const FewerThanLimit: Story = {
  args: {
    status: 'ready',
    ranking: sampleRanking.slice(0, 3),
    characterCount: 4,
    lookupTargetCount: 4,
  },
};
