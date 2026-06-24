'use client';

import { formatCost, formatTokens, hasKnownPricing } from '@wolfkrow/domain';
import type { UsageSummary } from '@wolfkrow/shared-types';
import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

function ModelBreakdownTable({ byModel }: { byModel: UsageSummary['byModel'] }) {
  const rows = Object.entries(byModel).sort(([, a], [, b]) => b.costUSD - a.costUSD);
  if (rows.length === 0) return null;
  return (
    <div className="rounded border p-4">
      <h3 className="mb-4 text-sm font-semibold">Usage by Model</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">Model</th>
            <th className="pb-2 pr-4 text-right">Input</th>
            <th className="pb-2 pr-4 text-right">Output</th>
            <th className="pb-2 text-right">Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([model, d]) => (
            <tr key={model} className="border-b last:border-0">
              <td className="py-2 pr-4 font-mono text-xs">{model}</td>
              <td className="py-2 pr-4 text-right">{formatTokens(d.inputTokens)}</td>
              <td className="py-2 pr-4 text-right">{formatTokens(d.outputTokens)}</td>
              <td className="py-2 text-right">
                {hasKnownPricing(model)
                  ? <span>{formatCost(d.costUSD)}</span>
                  : <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">unknown</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsageSummaryCards({ summary }: { summary: UsageSummary }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded border p-4">
        <p className="text-xs text-muted-foreground">Total Input Tokens</p>
        <p className="text-2xl font-bold">{summary.totalInputTokens.toLocaleString()}</p>
      </div>
      <div className="rounded border p-4">
        <p className="text-xs text-muted-foreground">Total Output Tokens</p>
        <p className="text-2xl font-bold">{summary.totalOutputTokens.toLocaleString()}</p>
      </div>
      <div className="rounded border p-4">
        <p className="text-xs text-muted-foreground">Total Cost</p>
        <p className="text-2xl font-bold">${summary.totalCostUSD.toFixed(4)}</p>
      </div>
    </div>
  );
}

interface DayDataItem { date: string; cost: number; inputTokens: number; outputTokens: number; }
function DayChart({ data }: { data: DayDataItem[] }) {
  if (data.length === 0) return null;
  return (
    <div className="rounded border p-4">
      <h3 className="mb-4 text-sm font-semibold">Cost per Day</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip formatter={(v: number) => [`$${v}`, 'Cost']} />
          <Bar dataKey="cost" fill="#6366f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UsageCharts() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    void fetch('/api/usage/summary')
      .then((r) => r.json() as Promise<UsageSummary>)
      .then(setSummary);
  }, []);

  if (!summary) return <div className="text-sm text-muted-foreground">Loading usage data…</div>;

  const dayData = summary.byDay
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      date: d.day.slice(5), // MM-DD
      cost: Number(d.costUSD.toFixed(4)),
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
    }));

  const sourceData = Object.entries(summary.bySource).map(([name, d]) => ({
    name,
    value: Number(d.costUSD.toFixed(4)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <UsageSummaryCards summary={summary} />
      <ModelBreakdownTable byModel={summary.byModel} />
      <DayChart data={dayData} />

      {/* Cost by source */}
      {sourceData.length > 0 && (
        <div className="rounded border p-4">
          <h3 className="mb-4 text-sm font-semibold">Cost by Source</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {sourceData.map((_e, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip formatter={(v: number) => [`$${v}`, 'Cost']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {dayData.length === 0 && sourceData.length === 0 && (
        <p className="text-sm text-muted-foreground">No usage data yet.</p>
      )}
    </div>
  );
}
