import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyCoderChunk,
  applyEvaluatorChunk,
  applyFeatureDone,
  applyProgress,
  applyToolCall,
  applyToolResult,
  initFeatures,
} from './feature-state';

export interface Feature {
  name: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface ToolCallChip {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
}

export interface FeatureState {
  coderText: string;
  currentRound: number;
  evaluatorText: string;
  index: number;
  name: string;
  rounds: number;
  stage: 'coder' | 'smoke' | 'evaluator' | 'idle';
  status: 'pending' | 'running' | 'passed' | 'failed';
  toolCalls: ToolCallChip[];
}

export type RunState = 'idle' | 'running' | 'done' | 'aborted' | 'error';
export interface RunResult {
  passed: number;
  total: number;
}

type SsePayload =
  | {
      type: 'progress';
      featureIndex: number;
      round: number;
      status: string;
      stage?: FeatureState['stage'];
    }
  | { type: 'coder-chunk'; featureIndex: number; delta: string }
  | { type: 'coder-tool-call'; featureIndex: number; call: { id: string; name: string } }
  | {
      type: 'coder-tool-result';
      featureIndex: number;
      result: { callId: string; isError: boolean };
    }
  | { type: 'evaluator-chunk'; featureIndex: number; delta: string }
  | { type: 'feature_done'; featureIndex: number; rounds: number; passed: boolean }
  | { type: 'done'; results: Array<{ featureIndex: number; passed: boolean }> };

interface HookReturn {
  abort: () => void;
  elapsed: number;
  error: string | null;
  featureStates: FeatureState[];
  result: RunResult | null;
  runState: RunState;
  start: () => void;
}

export const STAGE_LABEL: Record<string, string> = {
  coder: 'Coder',
  evaluator: 'Evaluator',
  idle: '',
  smoke: 'Smoke',
};

export function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function parseSse(raw: string): SsePayload | null {
  try {
    return JSON.parse(raw) as SsePayload;
  } catch {
    return null;
  }
}

function processLine(
  line: string,
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>,
  onDone: (result: RunResult) => void
): void {
  if (!line.startsWith('data: ')) return;
  const event = parseSse(line.slice(6));
  if (!event) return;
  applyEvent(event, setFeatureStates, onDone);
}

function applyEvent(
  event: SsePayload,
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>,
  onDone: (result: RunResult) => void
) {
  if (event.type === 'progress') {
    setFeatureStates((prev) =>
      applyProgress(prev, event.featureIndex, event.round, event.stage ?? 'evaluator')
    );
  } else if (event.type === 'coder-chunk') {
    setFeatureStates((prev) => applyCoderChunk(prev, event.featureIndex, event.delta));
  } else if (event.type === 'coder-tool-call') {
    setFeatureStates((prev) => applyToolCall(prev, event.featureIndex, event.call));
  } else if (event.type === 'coder-tool-result') {
    setFeatureStates((prev) =>
      applyToolResult(prev, event.featureIndex, event.result.callId, event.result.isError)
    );
  } else if (event.type === 'evaluator-chunk') {
    setFeatureStates((prev) => applyEvaluatorChunk(prev, event.featureIndex, event.delta));
  } else if (event.type === 'feature_done') {
    setFeatureStates((prev) =>
      applyFeatureDone(prev, event.featureIndex, event.rounds, event.passed)
    );
  } else if (event.type === 'done') {
    onDone({
      passed: event.results.filter((result) => result.passed).length,
      total: event.results.length,
    });
  }
}

async function readSseStream(
  body: ReadableStream,
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader | null>,
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>,
  onDone: (result: RunResult) => void
): Promise<void> {
  const reader = body.getReader();
  readerRef.current = reader;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) processLine(line, setFeatureStates, onDone);
  }
}

export function useHarnessRun(
  projectId: string,
  sprintId: string,
  features: Feature[]
): HookReturn {
  const [runState, setRunState] = useState<RunState>('idle');
  const [featureStates, setFeatureStates] = useState<FeatureState[]>(() => initFeatures(features));
  const [result, setResult] = useState<RunResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    setFeatureStates(initFeatures(features));
  }, [features]);
  useRunTimer(runState, startedAt, setElapsed);
  // Replay any persisted run timeline so the console restores after reconnect.
  useRunReplay(projectId, features, setFeatureStates, setResult);

  const abort = useCallback(() => {
    readerRef.current?.cancel().catch(() => undefined);
    void fetch(`/api/harness/projects/${projectId}/abort`, { method: 'POST' }).catch(
      () => undefined
    );
    setRunState('aborted');
  }, [projectId]);

  const start = useCallback(() => {
    setRunState('running');
    setFeatureStates(initFeatures(features));
    setResult(null);
    setError(null);
    setElapsed(0);
    startedAt.current = Date.now();
    void startHarnessRun({
      features,
      projectId,
      readerRef,
      setError,
      setFeatureStates,
      setResult,
      setRunState,
      sprintId,
    });
  }, [projectId, sprintId, features]);

  return { abort, elapsed, error, featureStates, result, runState, start };
}

function useRunTimer(
  runState: RunState,
  startedAt: React.MutableRefObject<number>,
  setElapsed: (elapsed: number) => void
) {
  useEffect(() => {
    if (runState !== 'running') return;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => clearInterval(tick);
  }, [runState, setElapsed, startedAt]);
}

/**
 * On mount, fetch + replay any persisted run timeline so the console restores
 * its state after a reconnect/refresh (Phase 6 — RunEvent persistence). The
 * live SSE stream replaces this once a new run starts. Best-effort.
 */
function useRunReplay(
  projectId: string,
  features: Feature[],
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>,
  setResult: (result: RunResult) => void
) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/harness/projects/${projectId}/run-events`);
        if (!res.ok) return;
        const { events } = (await res.json()) as { events: { payload: SsePayload }[] };
        if (cancelled || !events?.length) return;
        setFeatureStates(initFeatures(features));
        for (const e of events) {
          if (e.payload?.type) applyEvent(e.payload, setFeatureStates, (result) => setResult(result));
        }
      } catch {
        // Replay is best-effort; live state still works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
}

interface StartHarnessRunArgs {
  features: Feature[];
  projectId: string;
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader | null>;
  setError: (error: string | null) => void;
  setFeatureStates: React.Dispatch<React.SetStateAction<FeatureState[]>>;
  setResult: (result: RunResult) => void;
  setRunState: React.Dispatch<React.SetStateAction<RunState>>;
  sprintId: string;
}

async function startHarnessRun(args: StartHarnessRunArgs) {
  try {
    const response = await fetch(`/api/harness/projects/${args.projectId}/run`, {
      body: JSON.stringify({ sprintId: args.sprintId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!response.ok || !response.body) {
      args.setRunState('error');
      args.setError(`HTTP ${response.status}`);
      return;
    }

    await readSseStream(response.body, args.readerRef, args.setFeatureStates, (result) => {
      args.setResult(result);
      args.setRunState('done');
    });
    args.setRunState((state) => (state === 'running' ? 'done' : state));
  } catch (error) {
    args.setRunState((state) => (state === 'aborted' ? state : 'error'));
    args.setError(error instanceof Error ? error.message : 'Unknown error');
  }
}
