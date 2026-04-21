import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { RoleEditor } from './RoleEditor';
import { mockPlayers, mockChannelData } from '../lib/mockData';

const meta = {
  title: 'Organisms/RoleEditor',
  component: RoleEditor,
  parameters: { layout: 'padded' },
  decorators: [
    withStore({
      currentPlayerId: '100000000000000007',
      channelData: mockChannelData,
    }),
    (Story) => <div style={{ maxWidth: 420 }}><Story /></div>,
  ],
} satisfies Meta<typeof RoleEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentUser: Story = { args: { player: mockPlayers[6] } };

export const TankWithOffspecs: Story = { args: { player: mockPlayers[4] } };

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

export const HideSitOut: Story = {
  args: { player: mockPlayers[6], hideSitOut: true },
};
