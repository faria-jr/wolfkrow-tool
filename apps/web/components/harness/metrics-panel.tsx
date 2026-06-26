'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectMetrics {
  totalTokens: number;
  totalCost: number;
  roundCount: number;
  featuresPassed: number;
  featuresTotal: number;
  totalDurationMs: number;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function formatCost(cost: number): string {
  return cost > 0 ? `$${cost.toFixed(4)}` : '—';
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function passRate(m: ProjectMetrics): string {
  if (m.featuresTotal === 0) return '—';
  return `${m.featuresPassed}/${m.featuresTotal}`;
}

export interface MetricsPanelProps {
  metrics: ProjectMetrics;
}

export function MetricsPanel({ metrics: m }: MetricsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <KpiCard label="Tokens" value={m.totalTokens > 0 ? m.totalTokens.toLocaleString() : '—'} />
          <KpiCard label="Cost" value={formatCost(m.totalCost)} />
          <KpiCard label="Rounds" value={m.roundCount > 0 ? String(m.roundCount) : '—'} />
          <KpiCard label="Features passed" value={passRate(m)} />
          <KpiCard label="Duration" value={formatDuration(m.totalDurationMs)} />
        </div>
      </CardContent>
    </Card>
  );
}
