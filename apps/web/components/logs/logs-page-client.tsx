'use client';

import { AuditLogTable } from './audit-log-table';
import { LogViewer } from './log-viewer';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function LogsPageClient() {
  return (
    <Tabs defaultValue="worker" className="flex h-full flex-col">
      <TabsList className="w-fit">
        <TabsTrigger value="worker">Worker Logs</TabsTrigger>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
      </TabsList>
      <TabsContent value="worker" className="flex-1 overflow-hidden">
        <LogViewer />
      </TabsContent>
      <TabsContent value="audit" className="flex-1 overflow-auto">
        <AuditLogTable />
      </TabsContent>
    </Tabs>
  );
}
