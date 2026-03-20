import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
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
    withStore({
      identityResolved: false,
      currentPlayerId: null,
      currentPlayerName: null,
    }),
  ],
};

export const Resolved: Story = {
  decorators: [
    withStore({
      identityResolved: true,
      currentPlayerId: '100000000000000007',
      currentPlayerName: 'Tytanium',
    }),
  ],
};
