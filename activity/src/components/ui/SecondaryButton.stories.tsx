import type { Meta, StoryObj } from '@storybook/react-vite';
import { SecondaryButton } from './SecondaryButton';

const meta = {
  title: 'Atoms/SecondaryButton',
  component: SecondaryButton,
} satisfies Meta<typeof SecondaryButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: 'New Round' } };
export const Large: Story = { args: { children: 'New Round', large: true } };
export const Disabled: Story = { args: { children: 'New Round', disabled: true } };
