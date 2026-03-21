import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CharacterSearchInput } from './CharacterSearchInput';

const meta = {
  title: 'Atoms/CharacterSearchInput',
  component: CharacterSearchInput,
  decorators: [(Story) => <div style={{ maxWidth: 320, position: 'relative' }}><Story /></div>],
  parameters: {
    docs: {
      description: {
        component: 'Autocomplete input for searching WoW character names via Raider.io. Displays a dropdown of matching characters with realm and class info.',
      },
    },
  },
  args: {
    value: '',
    onChange: fn(),
    onSelect: fn(),
  },
} satisfies Meta<typeof CharacterSearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty state before typing */
export const Empty: Story = {};

/** Shows external loading spinner (e.g. while looking up a selected character) */
export const Loading: Story = {
  args: { value: 'Tytanium', loading: true },
};

/** With a pre-filled value (dropdown requires live API or interaction) */
export const WithValue: Story = {
  args: { value: 'Tytanium-Proudmoore' },
};
