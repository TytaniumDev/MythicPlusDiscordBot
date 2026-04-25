import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ReportBadGroupDialog } from './ReportBadGroupDialog';

const meta = {
  title: 'Molecules/ReportBadGroupDialog',
  component: ReportBadGroupDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: fn(),
    onSubmit: fn(async () => {}),
  },
} satisfies Meta<typeof ReportBadGroupDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
