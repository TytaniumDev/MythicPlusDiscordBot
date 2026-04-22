import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { IdentityView } from './IdentityView';
import type { WoWPlayer } from '../types';

const basePlayer = (over: Partial<WoWPlayer>): WoWPlayer => ({
  name: over.name ?? 'Player',
  discordId: over.discordId ?? '100000000000000001',
  mainRole: over.mainRole ?? null,
  offspecs: over.offspecs ?? [],
  utilities: over.utilities ?? [],
  ...over,
});

const tytanium = basePlayer({
  name: 'Tytanium',
  discordId: '100000000000000001',
  inGameName: 'Tytanium-Proudmoore',
  mainRole: 'ranged',
  mediaUrl: 'https://render.worldofwarcraft.com/us/character/proudmoore/1/184140522-inset.jpg',
  characterClass: 'Mage',
});

const martz = basePlayer({
  name: 'Martz',
  discordId: '100000000000000002',
  inGameName: 'Martz-Sargeras',
  mainRole: 'healer',
  mediaUrl: 'https://render.worldofwarcraft.com/us/character/sargeras/2/184140523-inset.jpg',
  characterClass: 'Paladin',
});

const pandemonium = basePlayer({
  name: 'Pandemonium',
  discordId: '100000000000000003',
  inGameName: 'Pandemonium-Sargeras',
  mainRole: 'tank',
  mediaUrl: 'https://render.worldofwarcraft.com/us/character/sargeras/3/184140524-inset.jpg',
  characterClass: 'Warrior',
});

const unmappedA = basePlayer({
  name: 'NewPlayer',
  discordId: '100000000000000004',
});

const unmappedB = basePlayer({
  name: 'GuestDPS',
  discordId: '100000000000000005',
});

const buildChannelData = (players: WoWPlayer[], claimed: string[] = []) => ({
  channelId: 'vc-1',
  channelName: 'Mythic Plus',
  guildId: 'demo-guild',
  status: 'lobby' as const,
  players,
  groups: [],
  claimedPlayers: claimed,
  sittingOut: [],
  isDebug: false,
  createdAt: Date.now(),
  lastActive: Date.now(),
});

const meta = {
  title: 'Pages/IdentityView',
  component: IdentityView,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'discordMedium' },
  },
  args: { onNavigate: fn() },
} satisfies Meta<typeof IdentityView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllMapped: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      channelData: buildChannelData([tytanium, martz, pandemonium]),
    }),
  ],
};

export const MixedMapping: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      channelData: buildChannelData([tytanium, unmappedA, martz, unmappedB, pandemonium]),
    }),
  ],
};

export const WithClaimed: Story = {
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      currentChannelId: 'vc-1',
      channelData: buildChannelData([tytanium, martz, pandemonium], [martz.discordId!]),
    }),
  ],
};
