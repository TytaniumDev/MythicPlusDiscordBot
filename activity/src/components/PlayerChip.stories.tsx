import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlayerChip } from './PlayerChip';

const meta = {
  title: 'Molecules/PlayerChip',
  component: PlayerChip,
  args: {
    onClick: () => {},
  },
} satisfies Meta<typeof PlayerChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tank: Story = {
  args: {
    name: 'Valeria',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [
      { label: 'Tank', cssClass: 'tag-tank' },
      { label: 'Brez', cssClass: 'tag-brez' },
    ],
    isReady: true,
  },
};

export const Healer: Story = {
  args: {
    name: 'Lumina',
    roleKey: 'healer',
    roleLabel: 'Healer',
    tags: [
      { label: 'Healer', cssClass: 'tag-healer' },
      { label: 'Off Ranged', cssClass: 'tag-dps tag-offspec' },
    ],
    isReady: true,
  },
};

export const RangedDPS: Story = {
  args: {
    name: 'Pyro',
    roleKey: 'ranged',
    roleLabel: 'Ranged',
    tags: [
      { label: 'Ranged', cssClass: 'tag-dps' },
      { label: 'Lust', cssClass: 'tag-lust' },
    ],
    isReady: true,
  },
};

export const MeleeDPS: Story = {
  args: {
    name: 'Slasher',
    roleKey: 'melee',
    roleLabel: 'Melee',
    tags: [{ label: 'Melee', cssClass: 'tag-dps' }],
    isReady: true,
  },
};

export const Selected: Story = {
  args: {
    name: 'You',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [{ label: 'Tank', cssClass: 'tag-tank' }],
    isReady: true,
    isSelected: true,
  },
};

export const SittingOut: Story = {
  args: {
    name: 'Afker',
    roleKey: 'healer',
    roleLabel: 'Healer',
    tags: [{ label: 'Healer', cssClass: 'tag-healer' }],
    isSittingOut: true,
  },
};

export const NotReady: Story = {
  args: {
    name: 'HasRoleNoName',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [{ label: 'Tank', cssClass: 'tag-tank' }],
    isReady: false,
  },
};

export const Unassigned: Story = {
  args: {
    name: 'NewPlayer',
    roleKey: 'unassigned',
    roleLabel: 'Unassigned',
    tags: [{ label: 'No roles', cssClass: 'tag-unassigned' }],
    isReady: false,
  },
};

export const WithPortrait: Story = {
  args: {
    name: 'Tytanium',
    roleKey: 'ranged',
    roleLabel: 'Ranged DPS',
    tags: [{ label: 'Lust', cssClass: 'tag-lust' }],
    isReady: true,
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    characterClass: 'Mage',
  },
};

export const WithPortraitSittingOut: Story = {
  args: {
    name: 'Tytanium',
    roleKey: 'ranged',
    roleLabel: 'Ranged DPS',
    tags: [],
    isSittingOut: true,
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    characterClass: 'Mage',
  },
};

export const PortraitFallbackLetter: Story = {
  args: {
    name: 'NewPlayer',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [],
    isReady: false,
    mediaUrl: null,
    characterClass: null,
  },
};

export const BrokenImageFallback: Story = {
  args: {
    name: 'BrokenTank',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [{ label: 'Off Healer', cssClass: 'tag-healer tag-offspec' }],
    isReady: true,
    mediaUrl: 'https://example.invalid/broken-inset.jpg',
    characterClass: 'Warrior',
  },
};
