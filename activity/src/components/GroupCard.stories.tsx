import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { GroupCard } from './GroupCard';
import { mockGroups } from '../lib/mockData';

const meta = {
  title: 'Organisms/GroupCard',
  component: GroupCard,
  decorators: [
    withStore({ currentPlayerId: '100000000000000007' }),
    (Story) => <div style={{ maxWidth: 360 }}><Story /></div>,
  ],
} satisfies Meta<typeof GroupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGroup: Story = {
  args: { group: mockGroups[0], index: 0 },
};

export const MyGroup: Story = {
  args: { group: mockGroups[1], index: 1 },
};

export const Remainder: Story = {
  args: { group: mockGroups[2], index: 2, label: 'Remainder', hideEmpty: true },
};

export const Compact: Story = {
  args: { group: mockGroups[0], index: 0, compact: true },
};

export const Strip: Story = {
  args: { group: mockGroups[0], index: 0, variant: 'strip' },
};
