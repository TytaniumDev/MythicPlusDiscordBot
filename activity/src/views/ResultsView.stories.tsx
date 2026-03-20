import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useAppStore } from '../store/store';
import { mockPlayers, mockGroups, mockChannelData } from '../lib/mockData';
import { ResultsView } from './ResultsView';

const meta = {
  title: 'Pages/ResultsView',
  component: ResultsView,
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
          channelData: {
            ...mockChannelData,
            status: 'completed',
            groups: mockGroups,
            players: mockPlayers,
          },
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
} satisfies Meta<typeof ResultsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DiscordSmall: Story = {
  parameters: { viewport: { defaultViewport: 'discordSmall' } },
};

export const DiscordLarge: Story = {
  parameters: { viewport: { defaultViewport: 'discordLarge' } },
};
