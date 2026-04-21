import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { EditPlayerModal } from './EditPlayerModal';
import { mockPlayers, mockChannelData } from '../lib/mockData';

const meta = {
  title: 'Organisms/EditPlayerModal',
  component: EditPlayerModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    withStore({
      currentPlayerId: '100000000000000007',
      channelData: mockChannelData,
    }),
  ],
  args: {
    onClose: () => {},
  },
} satisfies Meta<typeof EditPlayerModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tank: Story = { args: { player: mockPlayers[4] } };
export const Healer: Story = { args: { player: mockPlayers[0] } };
export const CurrentUser: Story = { args: { player: mockPlayers[6] } };
