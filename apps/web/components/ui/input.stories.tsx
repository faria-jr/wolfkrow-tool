import type { Meta, StoryObj } from '@storybook/react';

import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: 'text', defaultValue: 'Hello world' },
};

export const WithPlaceholder: Story = {
  args: { type: 'email', placeholder: 'name@example.com' },
};

export const Disabled: Story = {
  args: { type: 'text', defaultValue: 'Disabled', disabled: true },
};
