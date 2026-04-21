import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { Layout } from './Layout';

const meta = {
  title: 'Atoms/Layout',
  component: Layout,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>
        <h1>Page content goes here</h1>
      </div>
    ),
  },
};

export const WithStatusMessage: Story = {
  decorators: [withStore({ statusMessage: 'Connection lost. Retrying...' })],
  args: {
    children: (
      <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>
        <h1>Page content with status banner</h1>
      </div>
    ),
  },
};
