'use client';

import { TelegramSetup } from './telegram-setup';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHANNEL_CATALOG, type ChannelCatalogEntry } from '@/lib/channels';

function ChannelIcon({ type }: { type: ChannelCatalogEntry['type'] }) {
  const label = CHANNEL_CATALOG.find((c) => c.type === type)?.label ?? type;
  return <span className="text-lg font-semibold uppercase">{label.charAt(0)}</span>;
}

function ChannelCard({ entry }: { entry: ChannelCatalogEntry }) {
  const available = entry.status === 'available';
  return (
    <Card className={available ? '' : 'opacity-70'}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-muted"><ChannelIcon type={entry.type} /></span>
          {entry.label}
        </CardTitle>
        <Badge variant={available ? 'default' : 'outline'} className="text-xs">{available ? 'Available' : 'Em breve'}</Badge>
      </CardHeader>
      <CardContent>
        {entry.type === 'telegram' ? (
          <TelegramSetup />
        ) : (
          <p className="text-xs text-muted-foreground">Bridge + configuration coming soon.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ChannelsList() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CHANNEL_CATALOG.map((entry) => <ChannelCard key={entry.type} entry={entry} />)}
    </div>
  );
}
