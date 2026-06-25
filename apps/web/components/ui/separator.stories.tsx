import type { Meta, StoryObj } from '@storybook/react';

import { Separator } from './separator';

const meta = {
  title: 'UI/Separator',
  component: Separator,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="flex h-5 w-[250px] items-center">
      <span>Left</span>
      <Separator orientation="horizontal" className="mx-3 flex-1" />
      <span>Right</span>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center">
      <span>Left</span>
      <Separator orientation="vertical" className="mx-3 h-5" />
      <span>Right</span>
    </div>
  ),
};
