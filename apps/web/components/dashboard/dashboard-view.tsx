'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statusBadgeVariant } from '@/lib/status-badge';

interface HarnessProject {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  metrics: { totalTokens: number; totalCost: number };
}
interface PipelineProject {
  id: string;
  name: string;
  status: string;
  currentStage: string;
  createdAt: string;
}

interface RecentRun {
  id: string;
  name: string;
  status: string;
  href: string;
  createdAt: string;
}

interface DashboardKpis {
  tokens: number;
  cost: number;
  projects: number;
  activeRuns: number;
}

interface UsageBreakdown {
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  bySource: Record<string, UsageBreakdown>;
  byRuntime: Record<string, UsageBreakdown>;
  byDay: Array<{ day: string; inputTokens: number; outputTokens: number; costUSD: number }>;
}

const ACTIVE_STATUSES = ['running', 'in_progress', 'planning', 'active'];

function deriveKpis(harness: HarnessProject[], pipeline: PipelineProject[]): DashboardKpis {
  const tokens = harness.reduce((s, p) => s + (p.metrics?.totalTokens ?? 0), 0);
  const cost = harness.reduce((s, p) => s + (p.metrics?.totalCost ?? 0), 0);
  const activeRuns =
    harness.filter((p) => ACTIVE_STATUSES.includes(p.status)).length +
    pipeline.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;
  return { tokens, cost, projects: harness.length + pipeline.length, activeRuns };
}

function toRecentRuns(harness: HarnessProject[], pipeline: PipelineProject[]): RecentRun[] {
  return [
    ...harness.map((p) => ({ id: p.id, name: p.name, status: p.status, href: '/harness', createdAt: p.createdAt })),
    ...pipeline.map((p) => ({ id: p.id, name: p.name, status: p.status, href: '/pipeline', createdAt: p.createdAt })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
}

interface DashboardData {
  kpis: DashboardKpis;
  recent: RecentRun[];
  usage: UsageSummary | null;
  error: string | null;
}

/** Fetches harness + pipeline + usage summary and derives dashboard KPIs + recent runs. */
function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    kpis: { tokens: 0, cost: 0, projects: 0, activeRuns: 0 },
    recent: [],
    usage: null,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const [hRes, pRes, uRes] = await Promise.all([
        fetch('/api/harness/projects'),
        fetch('/api/pipeline/projects'),
        fetch('/api/usage/summary'),
      ]);
      const harness = hRes.ok ? ((await hRes.json()) as HarnessProject[]) : [];
      const pipeline = pRes.ok ? ((await pRes.json()) as PipelineProject[]) : [];
      const usage = uRes.ok ? ((await uRes.json()) as UsageSummary) : null;
      setData({
        kpis: deriveKpis(harness, pipeline),
        recent: toRecentRuns(harness, pipeline),
        usage,
        error: null,
      });
    } catch (err) {
      setData((d) => ({ ...d, error: err instanceof Error ? err.message : 'Failed to load dashboard' }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return data;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: 'New chat', href: '/chat' },
    { label: 'New pipeline', href: '/pipeline' },
    { label: 'Run audit', href: '/audit' },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.href} asChild variant="outline" size="sm">
          <Link href={a.href}>{a.label}</Link>
        </Button>
      ))}
    </div>
  );
}

function RecentRunRow({ run }: { run: RecentRun }) {
  return (
    <Link
      href={run.href}
      className="flex items-center justify-between rounded border bg-card px-3 py-2 text-sm hover:bg-muted"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{run.name}</p>
        <p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</p>
      </div>
      <Badge variant={statusBadgeVariant(run.status)} className="ml-2 shrink-0 text-xs">{run.status}</Badge>
    </Link>
  );
}

function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label="Tokens used" value={kpis.tokens > 0 ? kpis.tokens.toLocaleString() : '—'} />
      <KpiCard label="Total cost" value={kpis.cost > 0 ? `$${kpis.cost.toFixed(4)}` : '—'} />
      <KpiCard label="Projects" value={String(kpis.projects)} />
      <KpiCard label="Active runs" value={String(kpis.activeRuns)} />
    </div>
  );
}

function RuntimeSplitCard({ usage }: { usage: UsageSummary | null }) {
  if (!usage) return null;
  const cloud = usage.byRuntime['cloud'];
  const local = usage.byRuntime['local'];
  const sources = Object.entries(usage.bySource);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Usage breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Cloud cost</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {cloud ? `$${cloud.costUSD.toFixed(4)}` : '—'}
            </p>
          </div>
          <div className="rounded border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Local cost</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {local ? `$${local.costUSD.toFixed(4)}` : '—'}
            </p>
          </div>
        </div>
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sources.map(([name, b]) => (
              <Badge key={name} variant="outline" className="text-xs">
                {name}: ${b.costUSD.toFixed(2)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRunsCard({ recent, error }: { recent: RecentRun[]; error: string | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent runs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && recent.length === 0 && (
          <p className="text-sm text-muted-foreground">No runs yet. Start a harness or pipeline to see activity here.</p>
        )}
        {recent.map((run) => <RecentRunRow key={run.id} run={run} />)}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { kpis, recent, usage, error } = useDashboardData();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of runs, usage and quick actions.</p>
        </div>
        <QuickActions />
      </div>
      <KpiGrid kpis={kpis} />
      <RuntimeSplitCard usage={usage} />
      <RecentRunsCard recent={recent} error={error} />
    </div>
  );
}
