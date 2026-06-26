'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Feature { name: string; description: string; acceptanceCriteria: string[]; }

interface FeatureState {
  index: number;
  name: string;
  currentRound: number;
  stage: 'coder' | 'smoke' | 'evaluator' | 'idle';
  status: 'pending' | 'running' | 'passed' | 'failed';
  rounds: number;
}

type RunState = 'idle' | 'running' | 'done' | 'aborted' | 'error';
interface RunResult { passed: number; total: number; }

type SsePayload =
  | { type: 'progress'; featureIndex: number; round: number; status: string; stage?: 'coder' | 'smoke' | 'evaluator' }
  | { type: 'feature_done'; featureIndex: number; rounds: number; passed: boolean }
  | { type: 'done'; results: Array<{ featureIndex: number; passed: boolean }> };

function parseSse(raw: string): SsePayload | null {
  try { return JSON.parse(raw) as SsePayload; } catch { return null; }
}

function initFeatures(features: Feature[]): FeatureState[] {
  return features.map((f, i) => ({ index: i, name: f.name, currentRound: 0, stage: 'idle', status: 'pending', rounds: 0 }));
}

function applyProgress(prev: FeatureState[], featureIndex: number, round: number, stage: FeatureState['stage']): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, currentRound: round, stage, status: 'running' };
  return next;
}

function applyFeatureDone(prev: FeatureState[], featureIndex: number, rounds: number, passed: boolean): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, rounds, stage: 'idle', status: passed ? 'passed' : 'failed' };
  return next;
}

function processLine(
  line: string,
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>,
  onDone: (result: RunResult) => void,
): void {
  if (!line.startsWith('data: ')) return;
  const ev = parseSse(line.slice(6));
  if (!ev) return;
  if (ev.type === 'progress') {
    setFeatureStates((prev) => applyProgress(prev, ev.featureIndex, ev.round, ev.stage ?? 'evaluator'));
  } else if (ev.type === 'feature_done') {
    setFeatureStates((prev) => applyFeatureDone(prev, ev.featureIndex, ev.rounds, ev.passed));
  } else if (ev.type === 'done') {
    onDone({ passed: ev.results.filter((r) => r.passed).length, total: ev.results.length });
  }
}

async function readSseStream(
  body: ReadableStream,
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader | null>,
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>,
  onDone: (result: RunResult) => void,
): Promise<void> {
  const reader = body.getReader();
  readerRef.current = reader;
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) processLine(line, setFeatureStates, onDone);
  }
}

interface HookReturn {
  runState: RunState;
  featureStates: FeatureState[];
  result: RunResult | null;
  elapsed: number;
  error: string | null;
  start: () => void;
  abort: () => void;
}

function useHarnessRun(projectId: string, sprintId: string, features: Feature[]): HookReturn {
  const [runState, setRunState] = useState<RunState>('idle');
  const [featureStates, setFeatureStates] = useState<FeatureState[]>(() => initFeatures(features));
  const [result, setResult] = useState<RunResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const startedAt = useRef(0);

  useEffect(() => { setFeatureStates(initFeatures(features)); }, [features]);

  useEffect(() => {
    if (runState !== 'running') return;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => clearInterval(tick);
  }, [runState]);

  const abort = useCallback(() => {
    readerRef.current?.cancel().catch(() => undefined);
    setRunState('aborted');
  }, []);

  const start = useCallback(() => {
    setRunState('running');
    setFeatureStates(initFeatures(features));
    setResult(null);
    setError(null);
    setElapsed(0);
    startedAt.current = Date.now();

    const run = async () => {
      const res = await fetch(`/api/harness/projects/${projectId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId }),
      });
      if (!res.ok || !res.body) { setRunState('error'); setError(`HTTP ${res.status}`); return; }
      const onDone = (r: RunResult) => { setResult(r); setRunState('done'); };
      await readSseStream(res.body, readerRef, setFeatureStates, onDone);
      setRunState((s) => s === 'running' ? 'done' : s);
    };

    run().catch((err: unknown) => {
      setRunState((s) => s === 'aborted' ? s : 'error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    });
  }, [projectId, sprintId, features]);

  return { runState, featureStates, result, elapsed, error, start, abort };
}

const STAGE_LABEL: Record<string, string> = { coder: 'Coder', smoke: 'Smoke', evaluator: 'Evaluator', idle: '' };

function FeatureRow({ f }: { f: FeatureState }) {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    passed: 'default', failed: 'destructive', running: 'secondary', pending: 'outline',
  };
  return (
    <div className="flex items-center gap-3 rounded border bg-card px-3 py-2 text-sm">
      <span className="flex-1 truncate font-medium">{f.name || `Feature ${f.index + 1}`}</span>
      {f.status === 'running' && f.stage !== 'idle' && (
        <span className="text-xs text-muted-foreground">{STAGE_LABEL[f.stage]} · Round {f.currentRound}</span>
      )}
      <Badge variant={variantMap[f.status] ?? 'outline'} className="shrink-0 text-xs">{f.status}</Badge>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function RunControls({ runState, elapsed, start, abort, onClose }: { runState: RunState; elapsed: number; start: () => void; abort: () => void; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {runState === 'running' && <span className="text-xs text-muted-foreground">{formatMs(elapsed)}</span>}
      {runState === 'idle' && <Button size="sm" onClick={start}>Run</Button>}
      {runState === 'running' && <Button size="sm" variant="destructive" onClick={abort}>Abort</Button>}
      {(runState === 'done' || runState === 'aborted' || runState === 'error') && (
        <Button size="sm" variant="outline" onClick={start}>Run again</Button>
      )}
      <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
    </div>
  );
}

export interface ExecutionViewProps {
  projectId: string;
  sprintId: string;
  sprintName: string;
  features: Feature[];
  onClose: () => void;
}

export function ExecutionView({ projectId, sprintId, sprintName, features, onClose }: ExecutionViewProps) {
  const { runState, featureStates, result, elapsed, error, start, abort } = useHarnessRun(projectId, sprintId, features);
  const done = featureStates.filter((f) => f.status === 'passed' || f.status === 'failed').length;
  const progress = features.length > 0 ? Math.round((done / features.length) * 100) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Sprint: {sprintName}</CardTitle>
        <RunControls runState={runState} elapsed={elapsed} start={start} abort={abort} onClose={onClose} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {runState === 'running' && <Progress value={progress} className="h-1.5" />}
        {result && (
          <div className={`rounded px-3 py-2 text-sm font-medium ${result.passed === result.total ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
            {result.passed}/{result.total} features passed
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {runState === 'aborted' && <p className="text-sm text-muted-foreground">Run aborted.</p>}
        <div className="space-y-1.5">
          {featureStates.map((f) => <FeatureRow key={f.index} f={f} />)}
        </div>
      </CardContent>
    </Card>
  );
}
