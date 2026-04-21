import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpinWarningDialog } from './SpinWarningDialog';
import { mockPlayers } from '../lib/mockData';

const meta = {
  title: 'Organisms/SpinWarningDialog',
  component: SpinWarningDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    onGoBack: () => {},
    onSpinAnyway: () => {},
  },
} satisfies Meta<typeof SpinWarningDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const unassigned = {
  name: 'NewPlayer',
  discordId: '200000000000000001',
  mainRole: null,
  offspecs: [],
  utilities: [],
};
const assignedNoName = { ...mockPlayers[1], inGameName: undefined };

export const MissingRoleOnly: Story = {
  args: { missingRole: [unassigned], missingNameOnly: [] },
};

export const MissingNameOnly: Story = {
  args: { missingRole: [], missingNameOnly: [assignedNoName] },
};

export const Both: Story = {
  args: {
    missingRole: [unassigned],
    missingNameOnly: [assignedNoName],
  },
};
