import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmBackDialog } from './ConfirmBackDialog';

const meta = {
  title: 'Organisms/ConfirmBackDialog',
  component: ConfirmBackDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ConfirmBackDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DuringSpin: Story = { args: {} };

export const LeaveResults: Story = {
  args: {
    title: 'Leave Results?',
    message: 'This will end the current session and return everyone to the lobby.',
  },
};
