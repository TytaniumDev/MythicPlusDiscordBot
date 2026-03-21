import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { mockPlayers, mockChannelData } from '../lib/mockData';
import { MobilePlayerDrawer } from './MobilePlayerDrawer';

const meta = {
  title: 'Molecules/MobilePlayerDrawer',
  component: MobilePlayerDrawer,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile' },
  },
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      channelData: mockChannelData,
    }),
  ],
} satisfies Meta<typeof MobilePlayerDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { player: mockPlayers[0] }, // Martz: Healer, Tank+Melee offspec
};

export const WithTankMain: Story = {
  args: { player: mockPlayers[4] }, // Pandemonium: Tank main
};

export const Unassigned: Story = {
  args: {
    player: {
      ...mockPlayers[0],
      name: 'NewPlayer',
      discordId: '999',
      mainRole: null,
      offspecs: [],
      utilities: [],
    },
  },
};
