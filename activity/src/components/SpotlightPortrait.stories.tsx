import type { Meta, StoryObj } from '@storybook/react-vite';
import { CHARACTER_CLASSES } from '@mythicplus/shared';
import { SpotlightPortrait } from './SpotlightPortrait';

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
