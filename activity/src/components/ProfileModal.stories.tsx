import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockChannelData, mockPlayers } from '../lib/mockData';
import { ProfileModal } from './ProfileModal';

const meta = {
  title: 'Organisms/ProfileModal',
  component: ProfileModal,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onClose: fn(),
    onOpenConnections: fn(),
  },
} satisfies Meta<typeof ProfileModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoIdentity: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
  })],
};

export const WithLinkedCharacter: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    channelData: mockChannelData,
  })],
};

export const NoCharacterClass: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '999999999999999999',
    currentPlayerName: 'Mystery',
    identityResolved: true,
    channelData: {
      ...mockChannelData,
      players: [
        ...mockPlayers,
        {
          name: 'Mystery',
          discordId: '999999999999999999',
          mainRole: 'ranged',
          offspecs: [],
          utilities: [],
          mediaUrl: null,
          characterClass: null,
        },
      ],
    },
  })],
};

export const Closed: Story = {
  args: { open: false },
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    channelData: mockChannelData,
  })],
};
