import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
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
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      guildData: mockGuildData,
    }),
  ],
} satisfies Meta<typeof ChannelsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithChannels: Story = {};

export const Empty: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      guildData: { ...mockGuildData, voiceChannels: [] },
    }),
  ],
};

export const DiscordSmall: Story = {
  parameters: { viewport: { defaultViewport: 'discordSmall' } },
};

export const DiscordLarge: Story = {
  parameters: { viewport: { defaultViewport: 'discordLarge' } },
};
