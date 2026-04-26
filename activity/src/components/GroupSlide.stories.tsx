import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { showcaseGroups, SHOWCASE_CURRENT_PLAYER_ID, showcasePlayers } from '../lib/showcaseFixtures';
import type { WoWGroup, WoWPlayer } from '../types';
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

const singlePlayerRemainder: WoWGroup = {
  tank: null,
  healer: null,
  dps: [showcasePlayers[10]],
};

export const RemainderNoInvite: Story = {
  args: { group: singlePlayerRemainder, index: 99, label: 'Remainder' },
};

// Re-use a tank-main and put them in a DPS slot to exercise offspec rendering.
const offspecGroup: WoWGroup = {
  tank: showcasePlayers[0], // Gazzi (tank main)
  healer: showcasePlayers[1],
  dps: [
    // Same Gazzi data, different name and discordId so the slide treats it as
    // a separate slot occupant. mainRole stays 'tank' so this DPS column is
    // marked as offspec.
    {
      ...showcasePlayers[0],
      name: 'Gazzi-DPS',
      discordId: 'p01-dps',
    } as WoWPlayer,
    showcasePlayers[3],
    showcasePlayers[4],
  ],
};

export const OffspecDPS: Story = {
  args: { group: offspecGroup, index: 0 },
};
