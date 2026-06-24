import { Network } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { McpServersView } from '@/components/mcp/mcp-servers-view';

export const metadata = { title: 'MCP Servers' };

export default function McpServersPage() {
  return (
    <div className="container py-8">
      <PageHeader title="MCP Servers" description="Manage Model Context Protocol servers available to your agents." icon={<Network className="h-6 w-6" />} />
      <McpServersView />
    </div>
  );
}
