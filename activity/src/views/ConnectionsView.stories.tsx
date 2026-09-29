import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockGuildData } from '../lib/mockData';
import type { SeasonPairs } from '../types';
import { ConnectionsView } from './ConnectionsView';

const meta = {
  title: 'Pages/ConnectionsView',
  component: ConnectionsView,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'discordMedium' },
  },
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof ConnectionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

const populatedCounts: Record<string, number> = {
  'Fourseven|Quill': 12,
  'Fourseven|Maelstrom': 9,
  'Fourseven|Nyx': 7,
  'Fourseven|Brimstone': 5,
  'Fourseven|Ardent': 4,
  'Fourseven|Sable': 2,
  'Quill|Maelstrom': 6,
  'Quill|Nyx': 3,
  'Maelstrom|Nyx': 4,
  'Nyx|Brimstone': 2,
  'Brimstone|Ardent': 3,
  'Sable|Ardent': 1,
};

/** The demo guild carrying this season's pair counts. */
function withPairs(counts: SeasonPairs['counts']) {
  return { ...mockGuildData, seasonPairs: { seasonSlug: 'season-tww-3', counts } };
}

export const Populated: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    guildData: withPairs(populatedCounts),
  })],
};

export const NoPairsYet: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    guildData: withPairs({}),
  })],
};

export const NoIdentity: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    guildData: withPairs(populatedCounts),
  })],
};
