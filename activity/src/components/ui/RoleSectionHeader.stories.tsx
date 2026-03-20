import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoleSectionHeader } from './RoleSectionHeader';

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7l-9-5z" />
  </svg>
);

const meta = {
  component: RoleSectionHeader,
} satisfies Meta<typeof RoleSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tank: Story = { args: { label: 'Tanks', count: 2, color: 'tank', icon: <ShieldIcon /> } };
export const Healer: Story = { args: { label: 'Healers', count: 3, color: 'healer' } };
export const DPS: Story = { args: { label: 'DPS', count: 8, color: 'dps' } };
export const Unassigned: Story = { args: { label: 'Unassigned', count: 1, color: 'unassigned' } };
export const SittingOut: Story = { args: { label: 'Sitting Out', count: 2, color: 'sitting-out' } };
