'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface ChartPoint {
  roundNumber: number;
  coderTokens: number;
  evaluatorTokens: number;
}

interface MetricsChartProps {
  sprintId: string;
}

function tickFormatter(v: number): string {
  return v > 999 ? `${(v / 1000).toFixed(0)}k` : String(v);
}

export function MetricsChart({ sprintId }: MetricsChartProps) {
  const [chartData, setChartData] = useState<ChartPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/harness/sprints/${sprintId}/rounds`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RoundData[]) => {
        if (!cancelled) {
          setChartData(
            data.map((r) => ({
              roundNumber: r.roundNumber,
              coderTokens: r.metrics.coderTokens,
              evaluatorTokens: r.metrics.evaluatorTokens,
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setChartData([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  if (!chartData || chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Token usage by round</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="roundNumber"
              label={{ value: 'Round', position: 'insideBottomRight', offset: -4, fontSize: 10 }}
              tick={{ fontSize: 10 }}
            />
            <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={(val: number) => val.toLocaleString()} />
            <Area
              type="monotone"
              dataKey="coderTokens"
              name="Coder"
              stroke="hsl(var(--info))"
              fill="hsl(var(--info) / 0.15)"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="evaluatorTokens"
              name="Evaluator"
              stroke="hsl(var(--warning))"
              fill="hsl(var(--warning) / 0.15)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
