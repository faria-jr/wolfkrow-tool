import type { Metadata } from 'next';

import { AgentsView } from '@/components/agents/agents-view';

export const metadata: Metadata = {
  title: 'Agents',
  description: 'Manage AI agents',
};

export default function AgentsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div>
          <h1 className="text-lg font-semibold">Agents</h1>
          <p className="text-xs text-muted-foreground">Configure AI personas</p>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <AgentsView />
      </main>
    </div>
  );
}
