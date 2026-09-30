import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import type { WoWPlayer } from '../types';
import { mockPlayers, mockChannelData } from '../lib/mockData';
import { CharacterCard } from './CharacterCard';

const storeDefaults = {
  isDemoMode: true,
  currentGuildId: 'demo-guild',
  currentChannelId: 'vc-1',
  channelData: mockChannelData,
};

// Widths the card gets in the lobby: the desktop sidebar, and a 393px phone.
const sidebarWidth: Decorator = (Story) => <div style={{ width: 340 }}><Story /></div>;
const phoneWidth: Decorator = (Story) => <div style={{ width: 313 }}><Story /></div>;

const gazzi = mockPlayers[4]; // Tank main, ready
const needsName = { ...gazzi, inGameName: undefined, mediaUrl: null };
// Quill with both utilities: the most role tags a player can have.
const everyTag: WoWPlayer = { ...mockPlayers[0], utilities: ['brez', 'lust'] };

const meta = {
  title: 'Organisms/CharacterCard',
  component: CharacterCard,
  parameters: { layout: 'centered' },
  decorators: [withStore(storeDefaults)],
  args: { player: gazzi, isSittingOut: false, isSelf: true },
} satisfies Meta<typeof CharacterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sidebar layout: character column beside the always-open editor */
export const Sidebar: Story = {
  decorators: [sidebarWidth],
};

export const SidebarSittingOut: Story = {
  args: { isSittingOut: true },
  decorators: [sidebarWidth],
};

export const SidebarNeedsName: Story = {
  args: { player: needsName },
  decorators: [sidebarWidth],
};

/** Another player's card: headed with their name (see CharacterCardModal) */
export const SidebarOtherPlayer: Story = {
  args: { player: mockPlayers[0], isSelf: false },
  decorators: [sidebarWidth],
};

/** Phone layout: character beside the role tags, editor behind Edit */
export const Collapsible: Story = {
  args: { collapsible: true },
  decorators: [phoneWidth],
};

export const SittingOut: Story = {
  args: { collapsible: true, isSittingOut: true },
  decorators: [phoneWidth],
};

/** The header grows with the tags rather than clipping them */
export const EveryTag: Story = {
  args: { collapsible: true, player: everyTag },
  decorators: [phoneWidth],
};

/** No in-game name yet: flagged as not ready, editor opens automatically */
export const NeedsName: Story = {
  args: { collapsible: true, player: needsName },
  decorators: [phoneWidth],
};
