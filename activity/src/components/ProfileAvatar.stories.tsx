import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockChannelData, mockPlayers } from '../lib/mockData';
import { ProfileAvatar } from './ProfileAvatar';

const meta = {
  title: 'Molecules/ProfileAvatar',
  component: ProfileAvatar,
  parameters: { layout: 'centered' },
  args: { onClick: fn() },
} satisfies Meta<typeof ProfileAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
  })],
};

export const FromPreferences: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000099',
    currentPlayerName: 'Tytanium',
    identityResolved: false,
    channelData: null,
    profiles: {
      '100000000000000099': {
        roles: ['Healer'],
        inGameName: 'Tytanium-Stormrage',
        mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/1/1234567-inset.jpg',
        characterClass: 'Druid',
      },
    },
  })],
};

export const InLobby: Story = {
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
    channelData: mockChannelData,
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
  })],
};
