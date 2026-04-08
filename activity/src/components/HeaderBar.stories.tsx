import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { HeaderBar } from './HeaderBar';
import { CountBadge } from './ui';

const meta = {
  title: 'Organisms/HeaderBar',
  component: HeaderBar,
  decorators: [withStore({ isDemoMode: true })],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HeaderBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { title: 'Wheelson' },
};

export const WithBack: Story = {
  args: { title: 'Gif or Gif', subtitle: 'Mythic+ Lobby', onBack: fn() },
};

export const WithExtra: Story = {
  args: {
    title: 'Gif or Gif',
    subtitle: 'Mythic+ Lobby',
    onBack: fn(),
    extra: <CountBadge count={13} />,
  },
};

export const GoldTitle: Story = {
  args: { title: 'Results', titleColor: 'var(--color-gold)', onBack: fn() },
};
