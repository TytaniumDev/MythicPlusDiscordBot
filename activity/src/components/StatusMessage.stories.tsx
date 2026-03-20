import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { StatusMessage } from './StatusMessage';

const meta = {
  title: 'Atoms/StatusMessage',
  component: StatusMessage,
} satisfies Meta<typeof StatusMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithMessage: Story = {
  decorators: [
    withStore({ statusMessage: 'Spin request failed. Please try again.' }),
  ],
};
