import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ChannelCard } from './ChannelCard';

const meta = {
  component: ChannelCard,
  decorators: [(Story) => <div style={{ maxWidth: 400 }}><Story /></div>],
} satisfies Meta<typeof ChannelCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUsers: Story = {
  args: {
    channel: { id: 'vc-1', name: 'Mythic+ Lobby', userCount: 13 },
    onClick: fn(),
  },
};

export const SingleUser: Story = {
  args: {
    channel: { id: 'vc-2', name: 'Raid Voice', userCount: 1 },
    onClick: fn(),
  },
};

export const Empty: Story = {
  args: {
    channel: { id: 'vc-3', name: 'AFK', userCount: 0 },
    onClick: fn(),
  },
};
