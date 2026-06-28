import { ArrowLeft, Network } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { McpServerEditScreen } from '@/components/mcp/mcp-server-edit-screen';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'New MCP server' };

export default function NewMcpServerPage() {
  return (
    <PageShell>
      <PageHeader
        title="New MCP server"
        description="Register a custom MCP server command and runtime settings."
        icon={<Network className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline">
            <Link href="/mcp-servers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to MCP servers
            </Link>
          </Button>
        }
      />
      <PageContent>
        <McpServerEditScreen />
      </PageContent>
    </PageShell>
  );
}
