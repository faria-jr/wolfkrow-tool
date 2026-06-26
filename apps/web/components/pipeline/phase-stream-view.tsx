'use client';

import type React from 'react';
import { useCallback, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export interface PhaseCompleteData {
  output: string | undefined;
  phase: { status: string; stage: string } | undefined;
  project: { currentStage: string; status: string } | undefined;
  harnessProjectId: string | undefined;
  sprintCount: number | undefined;
}

type StreamState = 'idle' | 'starting' | 'running' | 'done' | 'error';

interface SseEvent {
  type: 'phase-start' | 'phase-complete' | 'done' | 'error';
  output?: string;
  phase?: { status: string; stage: string };
  project?: { currentStage: string; status: string };
  harnessProjectId?: string;
  sprintCount?: number;
  message?: string;
}

function parseSse(raw: string): SseEvent | null {
  try { return JSON.parse(raw) as SseEvent; } catch { return null; }
}

interface LineHandlers {
  setState: (s: StreamState) => void;
  setOutput: (o: string) => void;
  setError: (e: string) => void;
  onComplete: (d: PhaseCompleteData) => void;
}

function processLine(line: string, h: LineHandlers): void {
  if (!line.startsWith('data: ')) return;
  const ev = parseSse(line.slice(6));
  if (!ev) return;
  if (ev.type === 'phase-complete') {
    if (ev.output) h.setOutput(ev.output);
    h.onComplete({ output: ev.output, phase: ev.phase, project: ev.project, harnessProjectId: ev.harnessProjectId, sprintCount: ev.sprintCount });
  } else if (ev.type === 'error') {
    h.setError(ev.message ?? 'Phase failed');
    h.setState('error');
  } else if (ev.type === 'done') {
    h.setState('done');
  }
}

async function readStream(
  body: ReadableStream,
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader | null>,
  handlers: LineHandlers,
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
    for (const line of lines) processLine(line, handlers);
  }
}

interface HookReturn {
  state: StreamState;
  output: string | null;
  error: string | null;
  run: (userPrompt?: string) => void;
  abort: () => void;
  sendChat: (message: string) => Promise<void>;
  chatBusy: boolean;
}

function usePhaseStream(projectId: string, phaseId: string, onComplete: (d: PhaseCompleteData) => void): HookReturn {
  const [state, setState] = useState<StreamState>('idle');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  const abort = useCallback(() => {
    readerRef.current?.cancel().catch(() => undefined);
    setState('idle');
  }, []);

  const run = useCallback((userPrompt?: string) => {
    setState('starting');
    setOutput(null);
    setError(null);

    const execute = async () => {
      const res = await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/run/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPrompt !== undefined ? { userPrompt } : {}),
      });
      if (!res.ok || !res.body) { setState('error'); setError(`HTTP ${res.status}`); return; }
      setState('running');
      const handlers: LineHandlers = { setState, setOutput, setError: (e) => setError(e), onComplete };
      await readStream(res.body, readerRef, handlers);
      setState((s) => s === 'running' ? 'done' : s);
    };

    execute().catch((err: unknown) => {
      setState('error');
      setError(err instanceof Error ? err.message : 'Stream error');
    });
  }, [projectId, phaseId, onComplete]);

  const sendChat = useCallback(async (message: string) => {
    setChatBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { output?: string };
      if (data.output) setOutput((prev) => `${prev ?? ''}\n\n— user: ${message}\n\n— assistant: ${data.output}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat error');
    } finally {
      setChatBusy(false);
    }
  }, [projectId, phaseId]);

  return { state, output, error, run, abort, sendChat, chatBusy };
}

const STAGE_LABEL: Record<string, string> = {
  discovery: 'Discovery', spec_build: 'Spec Build', spec_validate: 'Spec Validate',
  approval: 'Approval', implementation: 'Implementation',
};

const STATE_VARIANT: Record<StreamState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  idle: 'outline', starting: 'secondary', running: 'secondary', done: 'default', error: 'destructive',
};

function StreamControls({ state, run, abort }: { state: StreamState; run: () => void; abort: () => void }) {
  const canRun = state === 'idle' || state === 'done' || state === 'error';
  const canAbort = state === 'starting' || state === 'running';
  return (
    <div className="flex items-center gap-2">
      {state !== 'idle' && <Badge variant={STATE_VARIANT[state]} className="text-xs">{state}</Badge>}
      {canRun && <Button size="sm" onClick={run}>{state === 'idle' ? 'Run' : 'Run again'}</Button>}
      {canAbort && <Button size="sm" variant="outline" onClick={abort}>Cancel</Button>}
    </div>
  );
}

export interface PhaseStreamViewProps {
  projectId: string;
  phaseId: string;
  stage: string;
  onComplete: (data: PhaseCompleteData) => void;
}

export function PhaseStreamView({ projectId, phaseId, stage, onComplete }: PhaseStreamViewProps) {
  const { state, output, error, run, abort, sendChat, chatBusy } = usePhaseStream(projectId, phaseId, onComplete);
  const [chatInput, setChatInput] = useState('');
  const handleSendChat = () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChatInput('');
    void sendChat(msg);
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{STAGE_LABEL[stage] ?? stage}</CardTitle>
        <StreamControls state={state} run={() => run()} abort={abort} />
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {output && (
          <pre className="max-h-64 overflow-auto rounded bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap">{output}</pre>
        )}
        {state === 'idle' && !output && (
          <p className="text-sm text-muted-foreground">Click Run to execute this phase with AI.</p>
        )}
        {output && (
          <div className="mt-2 flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="Continue the conversation…"
              disabled={chatBusy}
              aria-label="Phase chat input"
            />
            <Button size="sm" onClick={handleSendChat} disabled={chatBusy || !chatInput.trim()}>
              {chatBusy ? '…' : 'Send'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
