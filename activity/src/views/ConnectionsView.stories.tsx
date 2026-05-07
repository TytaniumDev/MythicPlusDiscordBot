import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { ConnectionsView } from './ConnectionsView';

const meta = {
  title: 'Pages/ConnectionsView',
  component: ConnectionsView,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'discordMedium' },
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

export const Populated: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    seasonPairs: {
      seasonSlug: 'season-tww-3',
      counts: populatedCounts,
    },
  })],
};

export const NoPairsYet: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    seasonPairs: {
      seasonSlug: 'season-tww-3',
      counts: {},
    },
  })],
};

export const NoIdentity: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    seasonPairs: {
      seasonSlug: 'season-tww-3',
      counts: populatedCounts,
    },
  })],
};
