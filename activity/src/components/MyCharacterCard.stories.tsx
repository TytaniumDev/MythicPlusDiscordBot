import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { mockPlayers, mockChannelData } from '../lib/mockData';
import { MyCharacterCard } from './MyCharacterCard';

const storeDefaults = {
  isDemoMode: true,
  currentGuildId: 'demo-guild',
  currentChannelId: 'vc-1',
  channelData: mockChannelData,
};

const meta = {
  title: 'Organisms/MyCharacterCard',
  component: MyCharacterCard,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(storeDefaults),
    (Story) => <div style={{ width: 360 }}><Story /></div>,
  ],
  args: { player: mockPlayers[4], isSittingOut: false }, // Gazzi: Tank main, ready
} satisfies Meta<typeof MyCharacterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sidebar layout: editor always open */
export const Sidebar: Story = {};

/** Phone layout: editor behind the Edit toggle */
export const Collapsible: Story = {
  args: { collapsible: true },
};

export const SittingOut: Story = {
  args: { collapsible: true, isSittingOut: true },
};

/** No in-game name yet: flagged as not ready, editor opens automatically */
export const NeedsName: Story = {
  args: {
    collapsible: true,
    player: { ...mockPlayers[4], inGameName: undefined, mediaUrl: null },
  },
};
