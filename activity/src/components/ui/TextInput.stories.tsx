import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextInput } from './TextInput';

const meta = {
  component: TextInput,
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { label: 'In-Game Name', placeholder: 'PlayerName-ServerName' } };
export const Filled: Story = { args: { label: 'In-Game Name', value: 'Tytanium-Proudmoore', readOnly: true } };
