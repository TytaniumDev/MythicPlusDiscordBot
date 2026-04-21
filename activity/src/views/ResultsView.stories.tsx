import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockChannelData } from '../lib/mockData';
import {
  showcasePlayers,
  showcaseGroups,
  SHOWCASE_CURRENT_PLAYER_ID,
} from '../lib/showcaseFixtures';
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
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      currentPlayerId: SHOWCASE_CURRENT_PLAYER_ID,
      currentPlayerName: 'Kaelith',
      identityResolved: true,
      channelData: {
        ...mockChannelData,
        status: 'completed',
        groups: showcaseGroups,
        players: showcasePlayers,
      },
    }),
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
