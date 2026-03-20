import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { GuildCard } from './GuildCard';

const meta = {
  component: GuildCard,
  decorators: [(Story) => <div style={{ maxWidth: 400 }}><Story /></div>],
} satisfies Meta<typeof GuildCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithIcon: Story = {
  args: {
    guild: {
      guildId: 'guild-1',
      guildName: 'Gif or Gif',
      guildIconUrl: 'https://placehold.co/32x32/8b5cf6/ffffff?text=G',
      lastVisited: Date.now() - 7200000,
    },
    onClick: fn(),
  },
};

export const WithoutIcon: Story = {
  args: {
    guild: {
      guildId: 'guild-2',
      guildName: 'Mythic Monday',
      lastVisited: Date.now() - 86400000,
    },
    onClick: fn(),
  },
};
