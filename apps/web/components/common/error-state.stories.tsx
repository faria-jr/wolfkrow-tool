import type { Meta, StoryObj } from '@storybook/react';
import { AlertOctagon } from 'lucide-react';
import { fn } from 'storybook/test';

import { ErrorState } from './error-state';

const meta = {
  title: 'Common/ErrorState',
  component: ErrorState,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'Something went wrong', description: 'Failed to load agents.' },
};

export const WithIcon: Story = {
  args: {
    title: 'Something went wrong',
    description: 'Failed to load agents.',
    icon: <AlertOctagon className="h-6 w-6" />,
  },
};

export const WithRetry: Story = {
  args: {
    title: 'Something went wrong',
    description: 'Failed to load agents.',
    icon: <AlertOctagon className="h-6 w-6" />,
    retryLabel: 'Try again',
    onRetry: fn(),
  },
};
