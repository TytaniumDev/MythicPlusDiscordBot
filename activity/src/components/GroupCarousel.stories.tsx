import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { showcaseGroups, SHOWCASE_CURRENT_PLAYER_ID } from '../lib/showcaseFixtures';
import { GroupCarousel, type GroupCarouselItem } from './GroupCarousel';

const items: GroupCarouselItem[] = [
  { group: showcaseGroups[0], index: 0 },
  { group: showcaseGroups[1], index: 1 },
  { group: showcaseGroups[2], index: 2, label: 'Remainder' },
];

const meta = {
  title: 'Organisms/GroupCarousel',
  component: GroupCarousel,
  parameters: { layout: 'fullscreen' },
  decorators: [withStore({ currentPlayerId: SHOWCASE_CURRENT_PLAYER_ID })],
} satisfies Meta<typeof GroupCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

function Wrapper(props: {
  initial: number;
  items: GroupCarouselItem[];
  onActiveIndexChange?: (next: number) => void;
}) {
  const [active, setActive] = useState(props.initial);
  return (
    <GroupCarousel
      items={props.items}
      activeIndex={active}
      onActiveIndexChange={setActive}
    />
  );
}

export const ThreeGroupsRemainder: Story = {
  args: {
    items,
    activeIndex: 1,
    onActiveIndexChange: () => {},
  },
  render: (args) => <Wrapper initial={args.activeIndex} items={args.items as GroupCarouselItem[]} />,
};

export const SingleGroup: Story = {
  args: {
    items: [items[0]],
    activeIndex: 0,
    onActiveIndexChange: () => {},
  },
  render: (args) => <Wrapper initial={args.activeIndex} items={args.items as GroupCarouselItem[]} />,
};
