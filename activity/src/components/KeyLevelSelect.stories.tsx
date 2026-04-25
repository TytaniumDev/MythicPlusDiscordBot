import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyLevelSelect } from './KeyLevelSelect';
import { KEY_LEVEL_DEFAULT } from '../lib/keyLevel';

const meta = {
  title: 'Atoms/KeyLevelSelect',
  component: KeyLevelSelect,
  parameters: { layout: 'centered' },
  render: (args) => {
    const [v, setV] = useState(args.value);
    return <KeyLevelSelect {...args} value={v} onChange={setV} />;
  },
  args: {
    value: KEY_LEVEL_DEFAULT,
    onChange: () => {},
    ariaLabel: 'Key level',
  },
} satisfies Meta<typeof KeyLevelSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { compact: true },
};
