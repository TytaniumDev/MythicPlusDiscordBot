import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { HomeView } from './HomeView';

const meta = {
  title: 'Pages/HomeView',
  component: HomeView,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'discordMedium' },
  },
  args: { onNavigate: fn() },
} satisfies Meta<typeof HomeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DiscordSmall: Story = {
  globals: {
    viewport: {
      value: 'discordSmall',
      isRotated: false
    }
  },
};

export const DiscordLarge: Story = {
  globals: {
    viewport: {
      value: 'discordLarge',
      isRotated: false
    }
  },
};
