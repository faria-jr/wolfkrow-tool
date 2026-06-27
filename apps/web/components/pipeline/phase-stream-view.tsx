'use client';

import type React from 'react';
import { useCallback, useRef, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Terminal,
  FileText,
  Play,
  Square,
  Send,
  Loader2,
  Cpu,
  RefreshCw,
  Sparkles,
  Bot
} from 'lucide-react';

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

  // Pre-load existing phase output if any exists in db
  useEffect(() => {
    let cancelled = false;
    async function loadExistingOutput() {
      try {
        const res = await fetch(`/api/pipeline/projects/${projectId}/phases`);
        if (res.ok) {
          const phases = (await res.json()) as Array<{ id: string; output?: string }>;
          const p = phases.find((phase) => phase.id === phaseId);
          if (!cancelled && p && p.output) {
            setOutput(p.output);
            setState('done');
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    void loadExistingOutput();
    return () => { cancelled = true; };
  }, [projectId, phaseId]);

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
      {state !== 'idle' && (
        <Badge variant={STATE_VARIANT[state]} className="text-[10px] font-mono uppercase">
          {state}
        </Badge>
      )}
      {canRun && (
        <Button size="sm" onClick={run} className="gap-1 text-xs">
          <Play className="h-3 w-3" /> {state === 'idle' ? 'Run' : 'Run again'}
        </Button>
      )}
      {canAbort && (
        <Button size="sm" variant="destructive" onClick={abort} className="gap-1 text-xs">
          <Square className="h-3 w-3" /> Cancel
        </Button>
      )}
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
  const logScrollRef = useRef<HTMLPreElement>(null);

  const handleSendChat = () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChatInput('');
    void sendChat(msg);
  };

  // Auto-scroll logs as they stream in
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-semibold text-zinc-300">
            Phase: {STAGE_LABEL[stage] ?? stage}
          </span>
        </div>
        <StreamControls state={state} run={() => run()} abort={abort} />
      </div>

      {/* Main split area */}
      <div className="flex-1 min-h-0 p-4">
        {output ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-0">
            {/* Left Column: Console logs */}
            <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden min-h-0">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40 shrink-0 text-[10px] font-semibold text-zinc-400">
                <Terminal className="h-3 w-3" /> LOG STREAM
              </div>
              <pre
                ref={logScrollRef}
                className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-words leading-relaxed select-text"
              >
                {output}
              </pre>
            </div>

            {/* Right Column: Rich document preview */}
            <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden min-h-0">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40 shrink-0 text-[10px] font-semibold text-zinc-400">
                <FileText className="h-3 w-3" /> ARTIFACT DOCUMENT PREVIEW
              </div>
              <ScrollArea className="flex-1 p-4 bg-zinc-950/40">
                <MarkdownDocPreview text={output} />
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-3">
            <Bot className="h-10 w-10 text-zinc-700" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-zinc-300">Ready to execute {STAGE_LABEL[stage] ?? stage}</p>
              <p className="text-[11px] text-zinc-500 max-w-sm">
                Click Run above to start streaming output from the AI agent orchestrator.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active agent thinking notification overlay */}
      {(state === 'running' || state === 'starting') && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/40 shrink-0 flex items-center justify-between text-xs text-primary font-mono animate-pulse">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Agent is executing {STAGE_LABEL[stage] ?? stage} stage...</span>
          </div>
          <span className="text-[10px] text-zinc-500">running agentic code-reviews</span>
        </div>
      )}

      {/* Interactive Chat Box at bottom */}
      {output && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/20 shrink-0 flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
            placeholder="Continue the conversation or give instructions to correct the specifications..."
            disabled={chatBusy}
            className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200"
            aria-label="Phase chat input"
          />
          <Button size="sm" onClick={handleSendChat} disabled={chatBusy || !chatInput.trim()} className="gap-1 text-xs">
            {chatBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Send
          </Button>
        </div>
      )}

      {error && (
        <div className="p-3 border-t border-red-500/20 bg-red-500/10 text-xs text-red-500 font-mono shrink-0">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

function MarkdownDocPreview({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-3 text-[11px] text-zinc-300 leading-relaxed font-sans select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} className="text-xs font-bold text-zinc-100 mt-4 border-b border-zinc-800/60 pb-1">{trimmed.slice(4)}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={idx} className="text-xs font-bold text-zinc-100 mt-6 border-b border-zinc-800 pb-1">{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={idx} className="text-sm font-bold text-primary mt-8 mb-2">{trimmed.slice(2)}</h2>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return <li key={idx} className="ml-4 list-disc text-zinc-300">{trimmed.slice(2)}</li>;
        }
        if (trimmed.startsWith('> ')) {
          return <blockquote key={idx} className="border-l-2 border-primary/40 bg-zinc-900/40 px-3 py-2 rounded text-zinc-400 italic my-2">{trimmed.slice(2)}</blockquote>;
        }
        if (trimmed.startsWith('```')) {
          return null; // Skip terminal fences
        }
        if (trimmed === '') return <div key={idx} className="h-2" />;
        return <p key={idx} className="text-zinc-300">{line}</p>;
      })}
    </div>
  );
}
