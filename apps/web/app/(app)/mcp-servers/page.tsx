import { McpServersView } from '@/components/mcp/mcp-servers-view';

export const metadata = { title: 'MCP Servers' };

export default function McpServersPage() {
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">MCP Servers</h1>
        <p className="text-muted-foreground">Manage Model Context Protocol servers available to your agents.</p>
      </div>
      <McpServersView />
    </div>
  );
}
