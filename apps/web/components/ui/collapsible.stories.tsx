import type { Meta, StoryObj } from '@storybook/react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

const meta = {
  title: 'UI/Collapsible',
  component: Collapsible,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-[350px] space-y-2">
      <div className="rounded-md border px-4 py-3 font-medium">Always visible</div>
      <CollapsibleTrigger className="text-sm underline">Toggle</CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-3 font-mono text-sm">
          Hidden until expanded.
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <Collapsible defaultOpen={false} className="w-[350px] space-y-2">
      <div className="rounded-md border px-4 py-3 font-medium">Always visible</div>
      <CollapsibleTrigger className="text-sm underline">Toggle</CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-3 font-mono text-sm">
          Hidden until expanded.
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
