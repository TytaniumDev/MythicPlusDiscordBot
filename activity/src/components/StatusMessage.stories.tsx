import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useAppStore } from '../store/store';
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
    (Story) => {
      useEffect(() => {
        useAppStore.setState({ statusMessage: 'Spin request failed. Please try again.' });
        return () => { useAppStore.setState({ statusMessage: '' }); };
      }, []);
      return <Story />;
    },
  ],
};
