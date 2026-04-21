import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpotlightPortraits } from './SpotlightPortraits';
import type { WoWPlayer } from '../types';

const meta = {
  title: 'Molecules/SpotlightPortraits',
  component: SpotlightPortraits,
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '2rem',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpotlightPortraits>;

export default meta;
type Story = StoryObj<typeof meta>;

const makePlayer = (
  name: string,
  mainRole: WoWPlayer['mainRole'],
  mediaUrl: string | null = null,
): WoWPlayer => ({
  name,
  discordId: name,
  mainRole,
  offspecs: [],
  utilities: [],
  mediaUrl,
});

export const CompleteGroup: Story = {
  args: {
    players: [
      makePlayer('Pandemonium', 'tank', 'https://render.worldofwarcraft.com/us/character/sargeras/123/184140522-inset.jpg'),
      makePlayer('Martz', 'healer', 'https://render.worldofwarcraft.com/us/character/illidan/456/184140522-inset.jpg'),
      makePlayer('Tytanium', 'melee', 'https://render.worldofwarcraft.com/us/character/proudmoore/789/184140522-inset.jpg'),
      makePlayer('Jules', 'ranged'),
      makePlayer('Dpser', 'melee'),
    ],
  },
};

export const MissingAvatars: Story = {
  args: {
    players: [
      makePlayer('Tanky', 'tank'),
      makePlayer('Healy', 'healer'),
      makePlayer('Pewpew', 'ranged'),
      makePlayer('Stabstab', 'melee'),
      makePlayer('Boomkin', 'ranged'),
    ],
  },
};
