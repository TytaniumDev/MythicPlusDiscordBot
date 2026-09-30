import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { mockPlayers } from '../lib/mockData';
import { getClassColor } from '../lib/classColors';
import { CharacterStage } from './CharacterStage';

const gazzi = mockPlayers[4];

// The stage takes its size from the parent.
const stageBox = (width: number, height: number): Decorator => (Story) => (
  <div style={{ display: 'grid', gridTemplate: '1fr / 1fr', width, height }}><Story /></div>
);
const sidebarColumn = stageBox(120, 268);

const meta = {
  title: 'Molecules/CharacterStage',
  component: CharacterStage,
  parameters: { layout: 'centered' },
  args: {
    mediaUrl: gazzi.mediaUrl,
    color: getClassColor(gazzi.characterClass),
    alt: `${gazzi.inGameName}, full-body render`,
  },
} satisfies Meta<typeof CharacterStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sidebar card's character column */
export const Default: Story = {
  decorators: [sidebarColumn],
};

/** Wide and short, like the phone card's header */
export const Banner: Story = {
  decorators: [stageBox(180, 176)],
};

export const Dimmed: Story = {
  args: { dimmed: true },
  decorators: [sidebarColumn],
};

export const NoRender: Story = {
  args: { mediaUrl: null, color: null, caption: 'Add your in-game name to show your character' },
  decorators: [sidebarColumn],
};
