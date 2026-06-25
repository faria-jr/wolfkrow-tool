import type { Meta, StoryObj } from '@storybook/react';

import { Toggle } from './toggle';

const meta = {
  title: 'UI/Toggle',
  component: Toggle,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg'],
    },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {
  args: { children: 'Bold', variant: 'default', 'aria-pressed': true },
};

export const Off: Story = {
  args: { children: 'Bold', variant: 'default', 'aria-pressed': false },
};
