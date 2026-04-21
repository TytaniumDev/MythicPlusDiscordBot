import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { SpotlightCard } from './SpotlightCard';
import { mockGroups } from '../lib/mockData';

const meta = {
  title: 'Organisms/SpotlightCard',
  component: SpotlightCard,
  parameters: { layout: 'fullscreen' },
  decorators: [
    withStore({ currentPlayerId: '100000000000000007' }),
    (Story) => (
      <div style={{ padding: '4rem 2rem', minHeight: '50vh', display: 'flex', justifyContent: 'center' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpotlightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: { group: mockGroups[0], index: 0, visible: true },
};

export const MyGroup: Story = {
  args: { group: mockGroups[1], index: 1, visible: true },
};

export const Hidden: Story = {
  args: { group: mockGroups[0], index: 0, visible: false },
};

export const Exiting: Story = {
  args: { group: mockGroups[0], index: 0, visible: true, exit: true },
};

export const CustomLabel: Story = {
  args: { group: mockGroups[0], index: 0, visible: true, label: "Final Group" },
};
