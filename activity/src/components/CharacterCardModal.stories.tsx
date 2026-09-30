import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { CharacterCardModal } from './CharacterCardModal';
import { mockPlayers, mockChannelData } from '../lib/mockData';

const meta = {
  title: 'Organisms/CharacterCardModal',
  component: CharacterCardModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    withStore({
      isDemoMode: true,
      currentChannelId: 'vc-1',
      currentPlayerId: '100000000000000007',
      channelData: mockChannelData,
    }),
  ],
  args: {
    isSittingOut: false,
    onClose: () => {},
  },
} satisfies Meta<typeof CharacterCardModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tank: Story = { args: { player: mockPlayers[4] } };
export const Healer: Story = { args: { player: mockPlayers[0] } };
export const SittingOut: Story = { args: { player: mockPlayers[5], isSittingOut: true } };
export const NeedsName: Story = {
  args: { player: { ...mockPlayers[4], inGameName: undefined, mediaUrl: null } },
};
