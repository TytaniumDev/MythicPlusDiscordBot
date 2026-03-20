import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useAppStore } from '../store/store';
import { mockGuildData } from '../lib/mockData';
import { ChannelsView } from './ChannelsView';

const meta = {
  title: 'Pages/ChannelsView',
  component: ChannelsView,
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
          guildData: mockGuildData,
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
} satisfies Meta<typeof ChannelsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithChannels: Story = {};

export const Empty: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          isDemoMode: true,
          currentGuildId: 'demo-guild',
          guildData: { ...mockGuildData, voiceChannels: [] },
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
