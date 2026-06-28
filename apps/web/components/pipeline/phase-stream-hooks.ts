import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PhaseCompleteData {
  harnessProjectId: string | undefined;
  output: string | undefined;
  phase: { status: string; stage: string } | undefined;
  project: { currentStage: string; status: string } | undefined;
  sprintCount: number | undefined;
}

export type StreamState = 'idle' | 'starting' | 'running' | 'done' | 'error';

interface SseEvent {
  harnessProjectId?: string;
  message?: string;
  output?: string;
  phase?: { status: string; stage: string };
  project?: { currentStage: string; status: string };
  sprintCount?: number;
  type: 'phase-start' | 'phase-complete' | 'done' | 'error';
}

interface LineHandlers {
  onComplete: (data: PhaseCompleteData) => void;
  setError: (error: string) => void;
  setOutput: (output: string) => void;
  setState: (state: StreamState) => void;
}

interface HookReturn {
  abort: () => void;
  chatBusy: boolean;
  error: string | null;
  output: string | null;
  run: (userPrompt?: string) => void;
  sendChat: (message: string) => Promise<void>;
  state: StreamState;
}

function parseSse(raw: string): SseEvent | null {
  try {
    return JSON.parse(raw) as SseEvent;
  } catch {
    return null;
  }
}

function processLine(line: string, handlers: LineHandlers): void {
  if (!line.startsWith('data: ')) return;
  const event = parseSse(line.slice(6));
  if (!event) return;

  if (event.type === 'phase-complete') {
    completePhase(event, handlers);
  } else if (event.type === 'error') {
    handlers.setError(event.message ?? 'Phase failed');
    handlers.setState('error');
  } else if (event.type === 'done') {
    handlers.setState('done');
  }
}

function completePhase(event: SseEvent, handlers: LineHandlers): void {
  if (event.output) handlers.setOutput(event.output);
  handlers.onComplete({
    harnessProjectId: event.harnessProjectId,
    output: event.output,
    phase: event.phase,
    project: event.project,
    sprintCount: event.sprintCount,
  });
}

async function readStream(
  body: ReadableStream,
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader | null>,
  handlers: LineHandlers
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
    for (const line of lines) processLine(line, handlers);
  }
}

/** Continuation-chat helper for a phase (best-effort append to output). */
function usePhaseChat(
  projectId: string,
  phaseId: string,
  setOutput: (updater: (prev: string | null) => string | null) => void,
  setError: (e: string | null) => void
) {
  const [chatBusy, setChatBusy] = useState(false);
  const sendChat = useCallback(
    async (message: string) => {
      setChatBusy(true);
      setError(null);
      try {
        const outputText = await sendPhaseChat(projectId, phaseId, message);
        if (outputText)
          setOutput(
            (previous) => `${previous ?? ''}\n\n- user: ${message}\n\n- assistant: ${outputText}`
          );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chat error');
      } finally {
        setChatBusy(false);
      }
    },
    [projectId, phaseId, setOutput, setError]
  );
  return { chatBusy, sendChat };
}

export function usePhaseStream(
  projectId: string,
  phaseId: string,
  onComplete: (data: PhaseCompleteData) => void
): HookReturn {
  const [state, setState] = useState<StreamState>('idle');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  useExistingPhaseOutput(projectId, phaseId, setOutput, setState);
  const { chatBusy, sendChat } = usePhaseChat(projectId, phaseId, setOutput, setError);

  const abort = useCallback(() => {
    readerRef.current?.cancel().catch(() => undefined);
    setState('idle');
    // Also stop the expensive server-side AI loop, not just the SSE consumer
    // (mirrors the Harness abort flow). Best-effort: a failed POST is fine.
    void fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/abort`, {
      method: 'POST',
    }).catch(() => undefined);
  }, [projectId, phaseId]);

  const run = useCallback(
    (userPrompt?: string) => {
      setState('starting');
      setOutput(null);
      setError(null);
      void runPhaseStream({
        onComplete,
        phaseId,
        projectId,
        readerRef,
        setError,
        setOutput,
        setState,
        userPrompt,
      });
    },
    [projectId, phaseId, onComplete]
  );

  return { abort, chatBusy, error, output, run, sendChat, state };
}

function useExistingPhaseOutput(
  projectId: string,
  phaseId: string,
  setOutput: (output: string) => void,
  setState: (state: StreamState) => void
) {
  useEffect(() => {
    let cancelled = false;
    void loadExistingPhaseOutput(projectId, phaseId).then((output) => {
      if (!cancelled && output) {
        setOutput(output);
        setState('done');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, phaseId, setOutput, setState]);
}

async function loadExistingPhaseOutput(projectId: string, phaseId: string) {
  try {
    const response = await fetch(`/api/pipeline/projects/${projectId}/phases`);
    if (!response.ok) return null;
    const phases = (await response.json()) as Array<{ id: string; output?: string }>;
    return phases.find((phase) => phase.id === phaseId)?.output ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

interface RunPhaseStreamArgs extends LineHandlers {
  phaseId: string;
  projectId: string;
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader | null>;
  userPrompt: string | undefined;
}

async function runPhaseStream(args: RunPhaseStreamArgs) {
  try {
    const response = await fetch(
      `/api/pipeline/projects/${args.projectId}/phases/${args.phaseId}/run/stream`,
      {
        body: JSON.stringify(args.userPrompt === undefined ? {} : { userPrompt: args.userPrompt }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );

    if (!response.ok || !response.body) {
      args.setError(`HTTP ${response.status}`);
      args.setState('error');
      return;
    }

    args.setState('running');
    await readStream(response.body, args.readerRef, args);
    args.setState('done');
  } catch (error) {
    args.setError(error instanceof Error ? error.message : 'Stream error');
    args.setState('error');
  }
}

async function sendPhaseChat(projectId: string, phaseId: string, message: string) {
  const response = await fetch(`/api/pipeline/projects/${projectId}/phases/${phaseId}/chat`, {
    body: JSON.stringify({ userPrompt: message }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { output?: string };
  return data.output;
}
