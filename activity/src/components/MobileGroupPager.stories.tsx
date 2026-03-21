import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { mockGroups, mockChannelData } from '../lib/mockData';
import { MobileGroupPager } from './MobileGroupPager';

const meta = {
  title: 'Molecules/MobileGroupPager',
  component: MobileGroupPager,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile' },
  },
  decorators: [
    withStore({
      isDemoMode: true,
      currentGuildId: 'demo-guild',
      channelData: mockChannelData,
    }),
  ],
} satisfies Meta<typeof MobileGroupPager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleGroup: Story = {
  args: {
    groupCards: [{ group: mockGroups[0], index: 0 }],
  },
};

export const MultipleGroups: Story = {
  args: {
    groupCards: mockGroups.map((g, i) => ({ group: g, index: i })),
  },
};

export const WithRemainder: Story = {
  args: {
    groupCards: [
      { group: mockGroups[0], index: 0 },
      { group: mockGroups[1], index: 1 },
      { group: mockGroups[2], index: 2, label: 'Remainder', hideEmpty: true },
    ],
  },
};
