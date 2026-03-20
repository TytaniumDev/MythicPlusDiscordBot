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
  parameters: { viewport: { defaultViewport: 'discordSmall' } },
};

export const DiscordLarge: Story = {
  parameters: { viewport: { defaultViewport: 'discordLarge' } },
};
