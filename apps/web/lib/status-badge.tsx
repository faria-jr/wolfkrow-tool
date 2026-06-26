/**
 * DEBT #14b (EPIC 3.4) — Shared status → Badge variant map.
 *
 * Eliminates the per-file status-color maps duplicated across dashboard,
 * harness-view, execution-view, phase-stream-view, channels, design-studio.
 * One canonical mapping: success-ish → default, running-ish → secondary,
 * failure-ish → destructive, idle/unknown → outline.
 */

import { Badge } from '@/components/ui/badge';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const SUCCESS = new Set(['completed', 'done', 'active', 'passed', 'ready', 'approved']);
const RUNNING = new Set(['running', 'in_progress', 'in-progress', 'planning', 'starting', 'streaming', 'pending', 'queued', 'working']);
const FAILURE = new Set(['failed', 'cancelled', 'canceled', 'rejected', 'error', 'crashed', 'blocked']);

export function statusBadgeVariant(status: string): BadgeVariant {
  const key = status.toLowerCase();
  if (SUCCESS.has(key)) return 'default';
  if (RUNNING.has(key)) return 'secondary';
  if (FAILURE.has(key)) return 'destructive';
  return 'outline';
}

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Badge that derives its variant from the status string. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={statusBadgeVariant(status)} className={className}>{status}</Badge>
  );
}
