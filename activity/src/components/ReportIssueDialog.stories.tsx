import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { ReportIssueDialog } from './ReportIssueDialog';

const meta = {
  title: 'Molecules/ReportIssueDialog',
  component: ReportIssueDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: fn(),
    onSubmit: fn(async () => {}),
  },
} satisfies Meta<typeof ReportIssueDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {
  decorators: [withStore({ verifiedDiscordId: '100000000000000099' })],
};

// Submitting waits for a Discord sign-in.
export const SignInNeeded: Story = {
  decorators: [withStore({ verifiedDiscordId: null, discordSignInAvailable: true })],
};
