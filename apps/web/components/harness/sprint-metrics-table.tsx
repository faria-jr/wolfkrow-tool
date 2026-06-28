'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * DEBT #12 (EPIC 1.5) — Per-round metrics breakdown for a harness sprint.
 *
 * The project MetricsPanel shows aggregates; this table breaks tokens down per
 * round and per agent (coder vs evaluator) + duration, giving the per-sprint /
 * per-agent cost view LionClaw surfaces. Reads the same rounds endpoint as
 * RoundsList (round.toProps exposes metrics.{coderTokens,evaluatorTokens,
 * durationMs}).
 */

interface RoundMetrics {
  coderTokens: number;
  evaluatorTokens: number;
  durationMs: number;
}
interface RoundData {
  roundNumber: number;
  status: string;
  metrics: RoundMetrics;
}

interface SprintMetricsTableProps {
  sprintId: string;
}

function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function Header() {
  return (
    <div className="text-muted-foreground grid grid-cols-4 gap-2 border-b pb-1 text-xs font-medium">
      <span>Round</span>
      <span className="text-right">Coder tok</span>
      <span className="text-right">Evaluator tok</span>
      <span className="text-right">Duration</span>
    </div>
  );
}

function Row({ round }: { round: RoundData }) {
  return (
    <div className="grid grid-cols-4 gap-2 py-1 text-xs tabular-nums">
      <span>{round.roundNumber}</span>
      <span className="text-right">{round.metrics.coderTokens.toLocaleString()}</span>
      <span className="text-right">{round.metrics.evaluatorTokens.toLocaleString()}</span>
      <span className="text-right">{formatMs(round.metrics.durationMs)}</span>
    </div>
  );
}

export function SprintMetricsTable({ sprintId }: SprintMetricsTableProps) {
  const [rounds, setRounds] = useState<RoundData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/harness/sprints/${sprintId}/rounds`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RoundData[]) => {
        if (!cancelled) setRounds(data);
      })
      .catch(() => {
        if (!cancelled) setRounds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  if (!rounds || rounds.length === 0) return null;

  const totals = rounds.reduce(
    (acc, r) => ({
      coder: acc.coder + r.metrics.coderTokens,
      evaluator: acc.evaluator + r.metrics.evaluatorTokens,
      duration: acc.duration + r.metrics.durationMs,
    }),
    { coder: 0, evaluator: 0, duration: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Round metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Header />
        {rounds.map((round) => (
          <Row key={round.roundNumber} round={round} />
        ))}
        <div className="mt-1 grid grid-cols-4 gap-2 border-t pt-1 text-xs font-semibold tabular-nums">
          <span>Total</span>
          <span className="text-right">{totals.coder.toLocaleString()}</span>
          <span className="text-right">{totals.evaluator.toLocaleString()}</span>
          <span className="text-right">{formatMs(totals.duration)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
