import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useAppStore } from '../store/store';
import { PlayerChip } from './PlayerChip';
import { mockPlayers } from '../lib/mockData';

const meta = {
  title: 'Molecules/PlayerChip',
  component: PlayerChip,
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          currentPlayerId: '100000000000000007',
          channelData: {
            channelId: 'vc-1',
            channelName: 'Mythic+ Lobby',
            guildId: 'demo-guild',
            status: 'lobby',
            players: mockPlayers,
            groups: [],
            claimedPlayers: ['100000000000000005'],
            sittingOut: [],
            isDebug: false,
            announceResults: true,
            createdAt: null,
            lastActive: null,
          },
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
} satisfies Meta<typeof PlayerChip>;

export default meta;
type Story = StoryObj<typeof meta>;

// Tank with brez - claimed
export const Tank: Story = { args: { player: mockPlayers[4] } };

// Healer with offspecs
export const Healer: Story = { args: { player: mockPlayers[0] } };

// Ranged DPS with lust
export const RangedDPS: Story = { args: { player: mockPlayers[1] } };

// Melee DPS (plain)
export const MeleeDPS: Story = { args: { player: mockPlayers[5] } };

// Current user (highlighted)
export const CurrentUser: Story = { args: { player: mockPlayers[6] } };

// Unassigned player
export const Unassigned: Story = {
  args: {
    player: {
      name: 'NewPlayer',
      discordId: '100000000000000099',
      mainRole: null,
      offspecs: [],
      utilities: [],
    },
  },
};
