import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockChannelData } from '../lib/mockData';
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

export const NoIdentity_Empty: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
    currentCharacter: null,
  })],
};

export const OutsideChannel_HasCharacter: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
    currentCharacter: {
      inGameName: 'Tytanium-Stormrage',
      region: 'us',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/1/1234567-inset.jpg',
      characterClass: 'Druid',
      lookupStatus: 'ok',
      lastUpdated: 1234567890,
    },
  })],
};

export const InsideChannel_LinkedCharacter: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    channelData: mockChannelData,
    currentCharacter: null,
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
