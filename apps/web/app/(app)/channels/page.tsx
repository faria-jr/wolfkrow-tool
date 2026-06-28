import { MessageSquare } from 'lucide-react';

import { ChannelsList } from '@/components/channels/channels-list';
import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';

export default function ChannelsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Channels"
        description="Connect external messaging channels"
        icon={<MessageSquare className="h-6 w-6" />}
      />
      <PageContent>
        <ChannelsList />
      </PageContent>
    </PageShell>
  );
}
