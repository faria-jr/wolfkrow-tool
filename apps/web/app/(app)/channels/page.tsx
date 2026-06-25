import { MessageSquare } from 'lucide-react';

import { TelegramSetup } from '@/components/channels/telegram-setup';
import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';

export default function ChannelsPage() {
  return (
    <PageShell>
      <PageHeader title="Channels" description="Connect external messaging channels" icon={<MessageSquare className="h-6 w-6" />} />
      <PageContent>
        <TelegramSetup />
      </PageContent>
    </PageShell>
  );
}
