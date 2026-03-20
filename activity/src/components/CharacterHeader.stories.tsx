import type { Meta, StoryObj } from '@storybook/react-vite';
import { CharacterHeader } from './CharacterHeader';

const meta = {
  component: CharacterHeader,
  decorators: [(Story) => <div style={{ maxWidth: 320 }}><Story /></div>],
} satisfies Meta<typeof CharacterHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tank: Story = {
  args: { name: 'Pandemonium', subtitle: 'Pandemonium-Sargeras', color: 'var(--color-tank)' },
};

export const Healer: Story = {
  args: { name: 'Martz', color: 'var(--color-healer)' },
};

export const DPS: Story = {
  args: { name: 'Tytanium', subtitle: 'Tytanium-Proudmoore', color: 'var(--color-dps)' },
};

export const Unassigned: Story = {
  args: { name: 'NewPlayer', color: 'var(--text-secondary)' },
};
