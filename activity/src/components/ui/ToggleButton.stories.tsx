import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleButton } from './ToggleButton';

const meta = {
  title: 'Atoms/ToggleButton',
  component: ToggleButton,
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = { args: { label: 'Tank' } };
export const Tank: Story = { args: { label: 'Tank', active: true, activeColor: 'tank' } };
export const Healer: Story = { args: { label: 'Healer', active: true, activeColor: 'healer' } };
export const DPS: Story = { args: { label: 'Ranged', active: true, activeColor: 'dps' } };
export const Brez: Story = { args: { label: 'Brez', active: true, activeColor: 'brez' } };
export const Lust: Story = { args: { label: 'Lust', active: true, activeColor: 'lust' } };
export const SittingOut: Story = { args: { label: 'Sit Out', active: true, activeColor: 'sitting-out' } };
