import type { Meta, StoryObj } from '@storybook/react';
import { FolderOpen } from 'lucide-react';
import { fn } from 'storybook/test';

import { EmptyState } from './empty-state';

const meta = {
  title: 'Common/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'No agents yet', description: 'Create one to get started.' },
};

export const WithIcon: Story = {
  args: {
    title: 'No agents yet',
    description: 'Create one to get started.',
    icon: <FolderOpen className="h-6 w-6" />,
  },
};

export const WithAction: Story = {
  args: {
    title: 'No agents yet',
    description: 'Create one to get started.',
    icon: <FolderOpen className="h-6 w-6" />,
    action: { label: 'Create agent', onClick: fn() },
  },
};
