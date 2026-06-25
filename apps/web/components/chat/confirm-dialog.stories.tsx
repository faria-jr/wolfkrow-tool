import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import { ConfirmDialog } from './confirm-dialog';

const meta = {
  title: 'Common/ConfirmDialog',
  component: ConfirmDialog,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    title: 'Delete agent',
    description: 'This action cannot be undone. The agent and its configuration will be permanently removed.',
    confirmLabel: 'Delete',
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const CustomLabels: Story = {
  args: {
    open: true,
    title: 'Reset permissions',
    description: 'Reset all stored tool permissions for this agent to the default Ask state?',
    confirmLabel: 'Reset',
    onConfirm: fn(),
    onCancel: fn(),
  },
};
