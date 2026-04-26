import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { showcaseGroups, SHOWCASE_CURRENT_PLAYER_ID } from '../lib/showcaseFixtures';
import { GroupSlide } from './GroupSlide';

const meta = {
  title: 'Organisms/GroupSlide',
  component: GroupSlide,
  parameters: { layout: 'centered' },
  decorators: [withStore({ currentPlayerId: SHOWCASE_CURRENT_PLAYER_ID })],
} satisfies Meta<typeof GroupSlide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGroup: Story = {
  args: { group: showcaseGroups[0], index: 0 },
};

export const Remainder: Story = {
  args: { group: showcaseGroups[2], index: 2, label: 'Remainder' },
};
