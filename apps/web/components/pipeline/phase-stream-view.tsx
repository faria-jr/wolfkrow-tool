'use client';

import { Bot, FileText, Loader2, Play, Send, Sparkles, Square, Terminal } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import type { PhaseCompleteData, StreamState } from './phase-stream-hooks';
import { usePhaseStream } from './phase-stream-hooks';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export type { PhaseCompleteData } from './phase-stream-hooks';

const STAGE_LABEL: Record<string, string> = {
  discovery: 'Discovery',
  spec_build: 'Spec Build',
  spec_validate: 'Spec Validate',
  design: 'Design',
  design_lock: 'Design Lock',
  approval: 'Approval',
  implementation: 'Implementation',
};

const STATE_VARIANT: Record<StreamState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  idle: 'outline',
  starting: 'secondary',
  running: 'secondary',
  done: 'default',
  error: 'destructive',
};

function StreamControls({
  state,
  run,
  abort,
}: {
  state: StreamState;
  run: () => void;
  abort: () => void;
}) {
  const canRun = state === 'idle' || state === 'done' || state === 'error';
  const canAbort = state === 'starting' || state === 'running';
  return (
    <div className="flex items-center gap-2">
      {state !== 'idle' && (
        <Badge variant={STATE_VARIANT[state]} className="font-mono text-xs uppercase">
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
  autoplay?: boolean;
  projectId: string;
  phaseId: string;
  stage: string;
  onComplete: (data: PhaseCompleteData) => void;
}

export function PhaseStreamView({ autoplay, projectId, phaseId, stage, onComplete }: PhaseStreamViewProps) {
  const { state, output, error, run, abort, sendChat, chatBusy } = usePhaseStream(
    projectId,
    phaseId,
    onComplete
  );
  const [chatInput, setChatInput] = useState('');
  const logScrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (autoplay && state === 'idle') run();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="flex h-full min-h-0 flex-col">
      <PhaseHeader abort={abort} run={() => run()} stage={stage} state={state} />
      <PhaseBody logScrollRef={logScrollRef} output={output} stage={stage} />
      <RunningNotice stage={stage} state={state} />
      <PhaseChatBox
        chatBusy={chatBusy}
        chatInput={chatInput}
        onSend={handleSendChat}
        setChatInput={setChatInput}
        visible={Boolean(output)}
      />
      {error && <ErrorBanner error={error} />}
    </div>
  );
}

function PhaseHeader({
  abort,
  run,
  stage,
  state,
}: {
  abort: () => void;
  run: () => void;
  stage: string;
  state: StreamState;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary h-4 w-4 animate-pulse" />
        <span className="text-xs font-semibold text-zinc-300">
          Phase: {STAGE_LABEL[stage] ?? stage}
        </span>
      </div>
      <StreamControls state={state} run={run} abort={abort} />
    </div>
  );
}

function PhaseBody({
  logScrollRef,
  output,
  stage,
}: {
  logScrollRef: React.RefObject<HTMLPreElement | null>;
  output: string | null;
  stage: string;
}) {
  return (
    <div className="min-h-0 flex-1 p-4">
      {output ? (
        <OutputPanels logScrollRef={logScrollRef} output={output} />
      ) : (
        <EmptyPhaseState stage={stage} />
      )}
    </div>
  );
}

function OutputPanels({
  logScrollRef,
  output,
}: {
  logScrollRef: React.RefObject<HTMLPreElement | null>;
  output: string;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
      <ConsolePanel logScrollRef={logScrollRef} output={output} />
      <PreviewPanel output={output} />
    </div>
  );
}

function ConsolePanel({
  logScrollRef,
  output,
}: {
  logScrollRef: React.RefObject<HTMLPreElement | null>;
  output: string;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <PanelTitle icon={<Terminal className="h-3 w-3" />} label="LOG STREAM" />
      <pre
        ref={logScrollRef}
        className="flex-1 select-text overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-zinc-300"
      >
        {output}
      </pre>
    </div>
  );
}

function PreviewPanel({ output }: { output: string }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <PanelTitle icon={<FileText className="h-3 w-3" />} label="ARTIFACT DOCUMENT PREVIEW" />
      <ScrollArea className="flex-1 bg-zinc-950/40 p-4">
        <MarkdownDocPreview text={output} />
      </ScrollArea>
    </div>
  );
}

function PanelTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-400">
      {icon} {label}
    </div>
  );
}

function EmptyPhaseState({ stage }: { stage: string }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-xs">
      <Bot className="h-10 w-10 text-zinc-700" />
      <div className="space-y-1 text-center">
        <p className="font-semibold text-zinc-300">
          Ready to execute {STAGE_LABEL[stage] ?? stage}
        </p>
        <p className="max-w-sm text-xs text-zinc-500">
          Click Run above to start streaming output from the AI agent orchestrator.
        </p>
      </div>
    </div>
  );
}

function RunningNotice({ stage, state }: { stage: string; state: StreamState }) {
  if (state !== 'running' && state !== 'starting') return null;
  return (
    <div className="text-primary flex shrink-0 animate-pulse items-center justify-between border-t border-zinc-800 bg-zinc-900/40 px-4 py-2 font-mono text-xs">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Agent is executing {STAGE_LABEL[stage] ?? stage} stage...</span>
      </div>
      <span className="text-xs text-zinc-500">running agentic code-reviews</span>
    </div>
  );
}

function PhaseChatBox({
  chatBusy,
  chatInput,
  onSend,
  setChatInput,
  visible,
}: {
  chatBusy: boolean;
  chatInput: string;
  onSend: () => void;
  setChatInput: (value: string) => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="flex shrink-0 gap-2 border-t border-zinc-800 bg-zinc-900/20 p-3">
      <Input
        aria-label="Phase chat input"
        className="border-zinc-800 bg-zinc-950 text-xs text-zinc-200"
        disabled={chatBusy}
        onChange={(event) => setChatInput(event.target.value)}
        onKeyDown={(event) => handleChatKeyDown(event, onSend)}
        placeholder="Continue the conversation or give instructions to correct the specifications..."
        value={chatInput}
      />
      <Button
        className="gap-1 text-xs"
        disabled={chatBusy || !chatInput.trim()}
        onClick={onSend}
        size="sm"
      >
        {chatBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        Send
      </Button>
    </div>
  );
}

function handleChatKeyDown(event: React.KeyboardEvent<HTMLInputElement>, onSend: () => void) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  onSend();
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="shrink-0 border-t border-red-500/20 bg-red-500/10 p-3 font-mono text-xs text-red-500">
      {error}
    </div>
  );
}

function MarkdownDocPreview({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="select-text space-y-3 font-sans text-xs leading-relaxed text-zinc-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="mt-4 border-b border-zinc-800/60 pb-1 text-xs font-bold text-zinc-100"
            >
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="mt-6 border-b border-zinc-800 pb-1 text-xs font-bold text-zinc-100"
            >
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-primary mb-2 mt-8 text-sm font-bold">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <li key={idx} className="ml-4 list-disc text-zinc-300">
              {trimmed.slice(2)}
            </li>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-primary/40 my-2 rounded border-l-2 bg-zinc-900/40 px-3 py-2 italic text-zinc-400"
            >
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        if (trimmed.startsWith('```')) {
          return null; // Skip terminal fences
        }
        if (trimmed === '') return <div key={idx} className="h-2" />;
        return (
          <p key={idx} className="text-zinc-300">
            {line}
          </p>
        );
      })}
    </div>
  );
}
