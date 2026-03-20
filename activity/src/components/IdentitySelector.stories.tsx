import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useAppStore } from '../store/store';
import { IdentitySelector } from './IdentitySelector';
import { mockPlayers } from '../lib/mockData';

const meta = {
  title: 'Organisms/IdentitySelector',
  component: IdentitySelector,
  args: { players: mockPlayers.slice(0, 5) },
} satisfies Meta<typeof IdentitySelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unresolved: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          identityResolved: false,
          currentPlayerId: null,
          currentPlayerName: null,
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
};

export const Resolved: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAppStore.setState({
          identityResolved: true,
          currentPlayerId: '100000000000000007',
          currentPlayerName: 'Tytanium',
        });
        return () => { useAppStore.getState().resetSession(); };
      }, []);
      return <Story />;
    },
  ],
};
