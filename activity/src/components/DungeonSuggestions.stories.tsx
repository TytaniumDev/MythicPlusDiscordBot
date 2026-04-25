import type { Meta, StoryObj } from '@storybook/react-vite';
import { DungeonSuggestions } from './DungeonSuggestions';
import type { DungeonSuggestion } from '../lib/dungeonSuggestions';

const sampleRanking: DungeonSuggestion[] = [
  { challengeModeId: 525, name: 'Operation: Floodgate', shortName: 'FLOOD', totalScore: 412, playersWithRuns: 3, avgLevel: 9.3 },
  { challengeModeId: 542, name: "Eco-Dome Al'dani", shortName: 'EDA', totalScore: 558, playersWithRuns: 4, avgLevel: 10.5 },
  { challengeModeId: 503, name: 'Ara-Kara, City of Echoes', shortName: 'ARAK', totalScore: 691, playersWithRuns: 5, avgLevel: 11.2 },
  { challengeModeId: 505, name: 'The Dawnbreaker', shortName: 'DAWN', totalScore: 740, playersWithRuns: 5, avgLevel: 11.6 },
  { challengeModeId: 499, name: 'Priory of the Sacred Flame', shortName: 'PSF', totalScore: 802, playersWithRuns: 5, avgLevel: 12.0 },
  { challengeModeId: 378, name: 'Halls of Atonement', shortName: 'HOA', totalScore: 855, playersWithRuns: 5, avgLevel: 12.4 },
  { challengeModeId: 391, name: 'Tazavesh: Streets of Wonder', shortName: 'STRT', totalScore: 902, playersWithRuns: 5, avgLevel: 12.8 },
  { challengeModeId: 392, name: "Tazavesh: So'leah's Gambit", shortName: 'GMBT', totalScore: 951, playersWithRuns: 5, avgLevel: 13.0 },
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
