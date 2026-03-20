import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useAppStore } from '../store/store';
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
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          isDemoMode: true,
          currentGuildId: 'demo-guild',
          currentChannelId: 'vc-1',
          currentPlayerId: '100000000000000007',
          currentPlayerName: 'Tytanium',
          identityResolved: true,
          channelData: mockChannelData,
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
} satisfies Meta<typeof LobbyView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FewPlayers: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          isDemoMode: true,
          currentPlayerId: '100000000000000001',
          currentPlayerName: 'Martz',
          identityResolved: true,
          channelData: {
            ...mockChannelData,
            players: mockPlayers.slice(0, 5),
          },
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
};

export const EmptyLobby: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          isDemoMode: true,
          channelData: {
            ...mockChannelData,
            players: [],
          },
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
};

export const WithSittingOut: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          isDemoMode: true,
          currentPlayerId: '100000000000000007',
          currentPlayerName: 'Tytanium',
          identityResolved: true,
          channelData: {
            ...mockChannelData,
            sittingOut: ['100000000000000005', '100000000000000008'],
          },
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
};

export const DiscordSmall: Story = {
  parameters: { viewport: { defaultViewport: 'discordSmall' } },
};

export const DiscordLarge: Story = {
  parameters: { viewport: { defaultViewport: 'discordLarge' } },
};
