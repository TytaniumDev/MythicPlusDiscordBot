import type { Meta, StoryObj } from '@storybook/react-vite';
import { WheelsGridComponent } from './WheelsGrid';
import { mockPlayers } from '../lib/mockData';
import { initPools } from '../lib/roles';

const meta = {
  title: 'Organisms/WheelsGrid',
  component: WheelsGridComponent,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', background: 'var(--color-bg)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WheelsGridComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullPool: Story = {
  args: { pools: initPools(mockPlayers) },
};

export const Empty: Story = {
  args: { pools: null },
};

export const MinimalPool: Story = {
  args: { pools: initPools(mockPlayers.slice(0, 5)) },
};
