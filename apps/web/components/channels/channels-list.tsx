'use client';

import { Hash, MessageCircle, MessageSquare, Phone, Settings } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useMemo, useState } from 'react';

import { TelegramSetup } from './telegram-setup';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CHANNEL_CATALOG, type ChannelCatalogEntry } from '@/lib/channels';

type ChannelType = ChannelCatalogEntry['type'];
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const CHANNEL_ICONS: Record<ChannelType, IconComponent> = {
  discord: MessageCircle,
  slack: Hash,
  telegram: MessageSquare,
  whatsapp: Phone,
};

function ChannelIcon({ type }: { type: ChannelType }) {
  const Icon = CHANNEL_ICONS[type];
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function availabilityLabel(entry: ChannelCatalogEntry): string {
  return entry.status === 'available' ? 'Available' : 'Coming soon';
}

function stateLabel(entry: ChannelCatalogEntry): string {
  return entry.status === 'available' ? 'Disconnected' : 'Planned';
}

function getChannelEntry(type: ChannelType): ChannelCatalogEntry {
  const selected = CHANNEL_CATALOG.find((entry) => entry.type === type);
  if (selected) return selected;
  const fallback = CHANNEL_CATALOG[0];
  if (fallback) return fallback;
  throw new Error('Channel catalog cannot be empty');
}

function ChannelConfigPanel({ entry }: { entry: ChannelCatalogEntry }) {
  const available = entry.status === 'available';
  return (
    <section className="bg-card rounded-lg border p-4" aria-label={`${entry.label} settings`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded">
            <ChannelIcon type={entry.type} />
          </span>
          <div>
            <h3 className="font-semibold">{entry.label}</h3>
            <p className="text-muted-foreground text-sm">
              {available ? 'Channel bridge configuration' : 'Bridge not enabled yet'}
            </p>
          </div>
        </div>
        <Badge variant={available ? 'default' : 'outline'}>{availabilityLabel(entry)}</Badge>
      </div>
      {entry.type === 'telegram' ? (
        <TelegramSetup />
      ) : (
        <p className="text-muted-foreground rounded border border-dashed p-4 text-sm">
          Configuration UI is prepared for this channel. The bridge is still coming soon.
        </p>
      )}
    </section>
  );
}

interface ChannelRowProps {
  entry: ChannelCatalogEntry;
  isSelected: boolean;
  onSelect: (type: ChannelType) => void;
}

function ChannelRow({ entry, isSelected, onSelect }: ChannelRowProps) {
  const available = entry.status === 'available';
  return (
    <TableRow data-state={isSelected ? 'selected' : undefined}>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded">
            <ChannelIcon type={entry.type} />
          </span>
          <span className="font-medium">{entry.label}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={available ? 'default' : 'outline'}>{availabilityLabel(entry)}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={available ? 'secondary' : 'outline'}>{stateLabel(entry)}</Badge>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant={isSelected ? 'secondary' : 'outline'}
          disabled={!available}
          aria-label={`Configure ${entry.label}`}
          onClick={() => onSelect(entry.type)}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configure
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ChannelsList() {
  const [selectedType, setSelectedType] = useState<ChannelType>('telegram');
  const selectedEntry = useMemo(() => getChannelEntry(selectedType), [selectedType]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <Table aria-label="Channel configuration">
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="w-36" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {CHANNEL_CATALOG.map((entry) => (
            <ChannelRow
              key={entry.type}
              entry={entry}
              isSelected={selectedEntry.type === entry.type}
              onSelect={setSelectedType}
            />
          ))}
        </TableBody>
      </Table>
      <ChannelConfigPanel entry={selectedEntry} />
    </div>
  );
}
