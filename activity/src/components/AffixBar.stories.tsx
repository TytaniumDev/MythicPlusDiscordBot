import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { AffixBar } from './AffixBar';

const meta = {
  title: 'Molecules/AffixBar',
  component: AffixBar,
  decorators: [withStore({ isDemoMode: true })],
} satisfies Meta<typeof AffixBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Displays the current week's affixes with color dots and wowhead links */
export const Default: Story = {};
