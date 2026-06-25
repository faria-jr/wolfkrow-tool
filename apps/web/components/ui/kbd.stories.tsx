import type { Meta, StoryObj } from '@storybook/react';

import { Kbd } from './kbd';

const meta = {
  title: 'UI/Kbd',
  component: Kbd,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: '⌘K' },
};
