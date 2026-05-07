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
const typoCharacter = {
  ...mockPlayers[1],
  name: 'Typo',
  discordId: '200000000000000002',
  inGameName: 'Tytaniumm-Stomrage',
  mediaUrl: null,
};

export const MissingRoleOnly: Story = {
  args: { missingRole: [unassigned], missingNameOnly: [], missingCharacterLookup: [] },
};

export const MissingNameOnly: Story = {
  args: { missingRole: [], missingNameOnly: [assignedNoName], missingCharacterLookup: [] },
};

export const MissingCharacterLookup: Story = {
  args: { missingRole: [], missingNameOnly: [], missingCharacterLookup: [typoCharacter] },
};

export const All: Story = {
  args: {
    missingRole: [unassigned],
    missingNameOnly: [assignedNoName],
    missingCharacterLookup: [typoCharacter],
  },
};
