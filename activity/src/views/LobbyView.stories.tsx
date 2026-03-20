import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockPlayers, mockChannelData } from '../lib/mockData';
import { LobbyView } from './LobbyView';

const meta = {
  title: 'Pages/LobbyView',
  component: LobbyView,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'discordMedium' },
  },
  args: { onNavigate: fn() },
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      currentPlayerId: '100000000000000007',
      currentPlayerName: 'Tytanium',
      identityResolved: true,
      channelData: mockChannelData,
    }),
  ],
} satisfies Meta<typeof LobbyView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FewPlayers: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      currentPlayerId: '100000000000000001',
      currentPlayerName: 'Martz',
      identityResolved: true,
      channelData: {
        ...mockChannelData,
        players: mockPlayers.slice(0, 5),
      },
    }),
  ],
};

export const EmptyLobby: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      channelData: {
        ...mockChannelData,
        players: [],
      },
    }),
  ],
};

export const WithSittingOut: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      currentPlayerId: '100000000000000007',
      currentPlayerName: 'Tytanium',
      identityResolved: true,
      channelData: {
        ...mockChannelData,
        sittingOut: ['100000000000000005', '100000000000000008'],
      },
    }),
  ],
};

export const DiscordSmall: Story = {
  parameters: { viewport: { defaultViewport: 'discordSmall' } },
};

export const DiscordLarge: Story = {
  parameters: { viewport: { defaultViewport: 'discordLarge' } },
};
