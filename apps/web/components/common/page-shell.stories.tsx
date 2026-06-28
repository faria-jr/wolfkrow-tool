import type { Meta, StoryObj } from '@storybook/react';
import { Bot } from 'lucide-react';

import { PageHeader } from './page-header';
import { PageContent, PageShell } from './page-shell';

const meta = {
  title: 'Common/PageShell',
  component: PageShell,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function Sample() {
  return (
    <PageShell>
      <PageHeader
        title="Agents"
        description="Configure AI personas"
        icon={<Bot className="h-6 w-6" />}
      />
      <PageContent>
        <p className="text-muted-foreground text-sm">
          Page content lives in a canonical scroll region.
        </p>
      </PageContent>
    </PageShell>
  );
}

export const Default: Story = { render: () => <Sample /> };

export const Narrow: Story = {
  render: () => (
    <PageShell variant="narrow">
      <PageHeader title="Settings" description="Narrow, centered content (max-w-content)." />
      <PageContent>
        <p className="text-muted-foreground text-sm">
          Narrow variant centers content with a max width.
        </p>
      </PageContent>
    </PageShell>
  ),
};

export const Flush: Story = {
  render: () => (
    <PageShell variant="flush">
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Flush variant — full-bleed, no padding (chat / terminal / graph).
      </div>
    </PageShell>
  ),
};
