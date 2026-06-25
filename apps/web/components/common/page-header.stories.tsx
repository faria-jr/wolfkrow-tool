import type { Meta, StoryObj } from '@storybook/react';
import { Bot } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { PageHeader } from './page-header';

const meta = {
  title: 'Common/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'Agents', description: 'Configure AI personas' },
};

export const WithIcon: Story = {
  args: { title: 'Agents', description: 'Configure AI personas', icon: <Bot className="h-6 w-6" /> },
};

export const WithActions: Story = {
  args: {
    title: 'Agents',
    description: 'Configure AI personas',
    actions: <Button size="sm">New Agent</Button>,
  },
};

export const Complete: Story = {
  args: {
    title: 'Agents',
    description: 'Configure AI personas',
    icon: <Bot className="h-6 w-6" />,
    actions: <Button size="sm">New Agent</Button>,
  },
};
