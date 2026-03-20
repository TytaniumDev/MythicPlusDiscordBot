import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrimaryCTA } from './PrimaryCTA';

const meta = {
  component: PrimaryCTA,
} satisfies Meta<typeof PrimaryCTA>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: 'Spin the Wheel!' } };
export const Disabled: Story = { args: { children: 'Spin the Wheel!', disabled: true } };

export const WithIcon: Story = {
  args: {
    children: 'Spin the Wheel!',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
};
