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

/** Displays only the week's rotating affix, with its short description and Wowhead link */
export const Default: Story = {};
