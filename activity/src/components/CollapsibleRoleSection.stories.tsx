import type { Meta, StoryObj } from '@storybook/react-vite';
import { CollapsibleRoleSection } from './CollapsibleRoleSection';

const meta = {
  title: 'Molecules/CollapsibleRoleSection',
  component: CollapsibleRoleSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CollapsibleRoleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const SampleChildren = () => (
  <div className="role-section__children">
    <div className="player-chip">
      <div className="chip-header"><span>Valeria</span></div>
    </div>
    <div className="player-chip">
      <div className="chip-header"><span>Grim</span></div>
    </div>
  </div>
);

export const Tank: Story = {
  args: {
    label: 'Tanks',
    count: 2,
    color: 'tank',
    children: <SampleChildren />,
  },
};

export const Healer: Story = {
  args: {
    label: 'Heal',
    count: 1,
    color: 'healer',
    children: <SampleChildren />,
  },
};

export const DPS: Story = {
  args: {
    label: 'Ranged',
    count: 3,
    color: 'dps',
    children: <SampleChildren />,
  },
};

export const DefaultCollapsed: Story = {
  args: {
    label: 'Melee',
    count: 4,
    color: 'dps',
    defaultCollapsed: true,
    children: <SampleChildren />,
  },
};
