import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountBadge } from './CountBadge';

const meta = {
  component: CountBadge,
} satisfies Meta<typeof CountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { count: 13 } };
export const Single: Story = { args: { count: 1 } };
export const Large: Story = { args: { count: 999 } };
