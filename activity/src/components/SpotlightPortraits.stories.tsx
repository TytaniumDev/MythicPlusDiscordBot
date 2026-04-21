import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpotlightPortraits } from './SpotlightPortraits';
import type { WoWPlayer } from '../types';
import type { CharacterClass } from '@mythicplus/shared';

const meta = {
  title: 'Molecules/SpotlightPortraits',
  component: SpotlightPortraits,
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: 'transparent',
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
  characterClass: CharacterClass | null = null,
): WoWPlayer => ({
  name,
  discordId: name,
  mainRole,
  offspecs: [],
  utilities: [],
  mediaUrl,
  characterClass,
});

export const CompleteGroup: Story = {
  args: {
    players: [{
      "name": "Gazzi",
      "discordId": "Gazzi",
      "mainRole": "tank",
      "offspecs": [],
      "utilities": [],
      "mediaUrl": "https://render.worldofwarcraft.com/us/character/uldum/0/172476416-inset.jpg",
      "characterClass": "Druid"
    }, {
      "name": "Sorovar",
      "discordId": "Sorovar",
      "mainRole": "healer",
      "offspecs": [],
      "utilities": [],
      "mediaUrl": "https://render.worldofwarcraft.com/us/character/uldum/23/175701015-inset.jpg",
      "characterClass": "Priest"
    }, {
      "name": "Tytaniormu",
      "discordId": "Tytaniormu",
      "mainRole": "ranged",
      "offspecs": [],
      "utilities": [],
      "mediaUrl": "https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg",
      "characterClass": "Hunter"
    }, {
      "name": "Quill",
      "discordId": "Quill",
      "mainRole": "ranged",
      "offspecs": [],
      "utilities": [],
      "mediaUrl": "https://render.worldofwarcraft.com/us/character/uldum/32/173283360-inset.jpg",
      "characterClass": "Druid"
    }, {
      "name": "Blueshift",
      "discordId": "Blueshift",
      "mainRole": "melee",
      "offspecs": [],
      "utilities": [],
      "mediaUrl": "https://render.worldofwarcraft.com/us/character/uldum/228/184072932-inset.jpg",
      "characterClass": "Demon Hunter"
    }],
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
