import type { Meta, StoryObj } from '@storybook/react';
import { AlertOctagon, Bot, FolderOpen } from 'lucide-react';
import { fn } from 'storybook/test';

import { Button } from '@/components/ui/button';

import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { PageHeader } from './page-header';
import { PageContent, PageShell } from './page-shell';

const meta = {
  title: 'Common/Composition',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<never>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical app shell (FE-1) composed: PageShell + PageHeader +
 * PageContent, with the standardized Empty / Error states inside.
 */
export const AppShell: Story = {
  render: () => (
    <PageShell>
      <PageHeader
        title="Agents"
        description="Configure AI personas"
        icon={<Bot className="h-6 w-6" />}
        actions={<Button size="sm">New Agent</Button>}
      />
      <PageContent className="space-y-6">
        <EmptyState
          title="No agents yet"
          description="Create one to get started."
          icon={<FolderOpen className="h-6 w-6" />}
          action={{ label: 'Create agent', onClick: fn() }}
        />
        <ErrorState
          title="Failed to load agents"
          description="The worker is unreachable."
          icon={<AlertOctagon className="h-6 w-6" />}
          retryLabel="Try again"
          onRetry={fn()}
        />
      </PageContent>
    </PageShell>
  ),
};
