import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MultiPicker, type PickerOption } from './MultiPicker';

const mainSpecOptions: PickerOption[] = [
  { label: 'Tank', value: 'tank', activeColor: 'tank' },
  { label: 'Healer', value: 'healer', activeColor: 'healer' },
  { label: 'Ranged', value: 'ranged', activeColor: 'dps' },
  { label: 'Melee', value: 'melee', activeColor: 'dps' },
];

const utilityOptions: PickerOption[] = [
  { label: 'Brez', value: 'brez', activeColor: 'brez' },
  { label: 'Lust', value: 'lust', activeColor: 'lust' },
];

const meta = {
  title: 'Molecules/MultiPicker',
  component: MultiPicker,
  render: function Render(args) {
    const [selected, setSelected] = useState(args.selected);
    return (
      <MultiPicker
        {...args}
        selected={selected}
        onToggle={(v) => setSelected((prev) =>
          prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]
        )}
      />
    );
  },
} satisfies Meta<typeof MultiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MainSpec: Story = {
  args: { label: 'Main Spec (pick one)', options: mainSpecOptions, selected: ['tank'], onToggle: fn() },
};

export const Utilities: Story = {
  args: { label: 'Utilities', options: utilityOptions, selected: ['brez', 'lust'], onToggle: fn() },
};

export const NoneSelected: Story = {
  args: { label: 'Main Spec', options: mainSpecOptions, selected: [], onToggle: fn() },
};
