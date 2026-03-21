import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { mockPlayers, mockChannelData } from '../lib/mockData';
import { PlayerCard } from './PlayerCard';

const storeDefaults = {
  isDemoMode: true,
  currentGuildId: 'demo-guild',
  currentChannelId: 'vc-1',
  channelData: mockChannelData,
};

const meta = {
  title: 'Organisms/PlayerCard',
  component: PlayerCard,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(storeDefaults),
    (Story) => <div style={{ width: 320 }}><Story /></div>,
  ],
} satisfies Meta<typeof PlayerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Healer with tank offspec and brez utility */
export const WithRoles: Story = {
  args: { player: mockPlayers[0] }, // Martz: Healer, Tank+Melee Offspec, Brez
};

/** Tank with in-game name set */
export const WithInGameName: Story = {
  args: { player: mockPlayers[4] }, // Pandemonium: Tank, inGameName set
};

/** Player with no roles assigned */
export const Unassigned: Story = {
  args: {
    player: {
      name: 'NewPlayer',
      discordId: '999',
      mainRole: null,
      offspecs: [],
      utilities: [],
    },
  },
};

/** Player sitting out this round */
export const SittingOut: Story = {
  args: { player: mockPlayers[4] }, // Pandemonium
  decorators: [
    withStore({
      ...storeDefaults,
      channelData: {
        ...mockChannelData,
        sittingOut: [mockPlayers[4].discordId!],
      },
    }),
    (Story) => <div style={{ width: 320 }}><Story /></div>,
  ],
};
