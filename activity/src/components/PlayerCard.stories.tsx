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
  args: { player: mockPlayers[0] }, // Quill: Healer with Tank/Ranged/Melee offspec, Brez
};

/** Tank with in-game name set */
export const WithInGameName: Story = {
  args: { player: mockPlayers[4] }, // Gazzi: Tank, inGameName set
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

/** Player with character image from Battle.net (Tytaniormu-Uldum) */
export const WithCharacterImage: Story = {
  args: {
    player: {
      name: 'Tytanium',
      discordId: '100000000000000007',
      inGameName: 'Tytaniormu-Uldum',
      mainRole: 'ranged',
      offspecs: ['healer'],
      utilities: ['lust'],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    },
  },
};

/** Player sitting out this round */
export const SittingOut: Story = {
  args: { player: mockPlayers[4] }, // Gazzi
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
