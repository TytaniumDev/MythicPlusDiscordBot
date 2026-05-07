import type { Meta, StoryObj } from '@storybook/react-vite';
import { CHARACTER_CLASSES } from '@mythicplus/shared';
import { SpotlightPortrait } from './SpotlightPortrait';
import type { CharacterDungeonScores } from '../lib/dungeonScoreTypes';

// Realistic-looking sample so the hover/focus tooltip has something to show.
// Edit `name`, `score`, `level`, and `iconUrl` here to preview different
// score profiles in Storybook.
const SAMPLE_SCORES: CharacterDungeonScores = {
  name: 'Gazzi',
  realm: 'Uldum',
  region: 'us',
  overallScore: 3214.5,
  scoreColor: '#ff8000', // orange (epic-tier)
  className: 'Druid',
  specName: 'Guardian',
  byDungeon: {
    525: { challengeModeId: 525, name: 'Operation: Floodgate', shortName: 'FLOOD', level: 14, score: 412, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_waterworks.jpg' },
    542: { challengeModeId: 542, name: "Eco-Dome Al'dani", shortName: 'EDA', level: 13, score: 388, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/inv_112_achievement_dungeon_ecodome.jpg' },
    503: { challengeModeId: 503, name: 'Ara-Kara, City of Echoes', shortName: 'ARAK', level: 14, score: 421, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_arak-ara.jpg' },
    505: { challengeModeId: 505, name: 'The Dawnbreaker', shortName: 'DAWN', level: 12, score: 360, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_dawnbreaker.jpg' },
    499: { challengeModeId: 499, name: 'Priory of the Sacred Flame', shortName: 'PSF', level: 13, score: 395, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/inv_achievement_dungeon_prioryofthesacredflame.jpg' },
    378: { challengeModeId: 378, name: 'Halls of Atonement', shortName: 'HOA', level: 12, score: 358, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/achievement_dungeon_hallsofattonement.jpg' },
    391: { challengeModeId: 391, name: 'Tazavesh: Streets of Wonder', shortName: 'STRT', level: 13, score: 392, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/achievement_dungeon_brokerdungeon.jpg' },
    392: { challengeModeId: 392, name: "Tazavesh: So'leah's Gambit", shortName: 'GMBT', level: 14, score: 415, iconUrl: 'https://cdn.raiderio.net/images/wow/icons/large/achievement_dungeon_theotherside_dealergexa.jpg' },
  },
};

const NEW_PLAYER_SCORES: CharacterDungeonScores = {
  name: 'Freshalt',
  realm: 'Uldum',
  region: 'us',
  overallScore: null,
  scoreColor: null,
  className: 'Hunter',
  specName: 'Beast Mastery',
  byDungeon: {},
};

const meta = {
  title: 'Atoms/SpotlightPortrait',
  component: SpotlightPortrait,
  argTypes: {
    characterClass: {
      control: { type: 'select' },
      options: [null, ...CHARACTER_CLASSES],
    },
  },
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
} satisfies Meta<typeof SpotlightPortrait>;

export default meta;
type Story = StoryObj<typeof meta>;

const GAZZI_MEDIA = 'https://render.worldofwarcraft.com/us/character/uldum/0/172476416-inset.jpg';

export const Druid: Story = {
  args: {
    name: 'Gazzi',
    characterClass: 'Druid',
    mediaUrl: GAZZI_MEDIA,
  },
};

export const Mage: Story = {
  args: {
    name: 'Tytaniormu',
    characterClass: 'Mage',
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
  },
};

export const DemonHunter: Story = {
  args: {
    name: 'Blueshift',
    characterClass: 'Demon Hunter',
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/228/184072932-inset.jpg',
  },
};

export const UnknownClass: Story = {
  args: {
    name: 'Mystery',
    characterClass: null,
    mediaUrl: GAZZI_MEDIA,
  },
};

export const MissingAvatar: Story = {
  args: {
    name: 'Tanky',
    characterClass: null,
    mediaUrl: null,
  },
};

/**
 * Hover (or tab to + focus) the portrait to reveal the M+ score tooltip.
 * The tooltip shows the character's overall Raider.io score plus the
 * per-dungeon breakdown sorted by best score, descending.
 */
export const WithScoresOnHover: Story = {
  args: {
    name: 'Gazzi',
    characterClass: 'Druid',
    mediaUrl: GAZZI_MEDIA,
    scores: SAMPLE_SCORES,
  },
};

/** A character with no recorded runs this season — tooltip shows the empty
 *  state instead of an empty list. */
export const WithScoresEmptySeason: Story = {
  args: {
    name: 'Freshalt',
    characterClass: 'Hunter',
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    scores: NEW_PLAYER_SCORES,
  },
};
