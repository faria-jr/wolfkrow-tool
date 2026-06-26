/**
 * EPIC 4.1 — Channel catalog (data-driven).
 *
 * Single source for the supported channel set — matches the channels seeder
 * (apps/worker/src/seed-data/channels-seeder.ts CHANNEL_TYPES) + the DB enum.
 * Telegram is functional; Discord/Slack/WhatsApp are exposed as "Em breve"
 * (LionClaw parity — listing with status, bridges deferred).
 */

export type ChannelType = 'telegram' | 'discord' | 'slack' | 'whatsapp';
export type ChannelStatus = 'available' | 'coming_soon';

export interface ChannelCatalogEntry {
  type: ChannelType;
  label: string;
  status: ChannelStatus;
}

export const CHANNEL_CATALOG: readonly ChannelCatalogEntry[] = [
  { type: 'telegram', label: 'Telegram', status: 'available' },
  { type: 'discord', label: 'Discord', status: 'coming_soon' },
  { type: 'slack', label: 'Slack', status: 'coming_soon' },
  { type: 'whatsapp', label: 'WhatsApp', status: 'coming_soon' },
] as const;
