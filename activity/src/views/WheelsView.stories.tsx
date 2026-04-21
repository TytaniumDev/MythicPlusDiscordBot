import { useEffect, useCallback, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { useAppStore } from '../store/store';
import { mockChannelData } from '../lib/mockData';
import {
  showcasePlayers,
  showcaseGroups,
  SHOWCASE_CURRENT_PLAYER_ID,
} from '../lib/showcaseFixtures';
import { WheelsView } from './WheelsView';
import type { ChannelData } from '../types';
import type { ViewName } from '../store/types';

const spinningChannelData: ChannelData = {
  ...mockChannelData,
  status: 'spinning',
  players: showcasePlayers,
  groups: showcaseGroups,
  revealedGroups: 0,
};

/** Wrapper that catches `onNavigate('results')` and either stops or restarts the spin for visual testing. */
function WheelsViewHarness({ loop }: { loop: boolean }) {
  const completedRef = useRef(false);

  const onNavigate = useCallback((view: ViewName) => {
    if (view !== 'results') return;
    if (completedRef.current && !loop) return;
    completedRef.current = true;

    if (!loop) return;

    setTimeout(() => {
      const store = useAppStore.getState();
      store.resetSpinState();
      store.setChannelData({ ...spinningChannelData, revealedGroups: 0 });
      completedRef.current = false;
    }, 800);
  }, [loop]);

  useEffect(() => {
    useAppStore.getState().setChannelData({ ...spinningChannelData });
  }, []);

  return <WheelsView onNavigate={onNavigate} />;
}

const meta = {
  title: 'Pages/WheelsView',
  component: WheelsViewHarness,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'discordMedium' },
  },
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      currentPlayerId: SHOWCASE_CURRENT_PLAYER_ID,
      currentPlayerName: 'Kaelith',
      identityResolved: true,
      channelData: spinningChannelData,
    }),
  ],
} satisfies Meta<typeof WheelsViewHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { loop: false },
};

export const Looping: Story = {
  args: { loop: true },
};

export const DiscordSmall: Story = {
  args: { loop: false },
  parameters: { viewport: { defaultViewport: 'discordSmall' } },
};

export const DiscordLarge: Story = {
  args: { loop: false },
  parameters: { viewport: { defaultViewport: 'discordLarge' } },
};
