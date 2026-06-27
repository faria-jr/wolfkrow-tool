'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { statusBadgeVariant } from '@/lib/status-badge';
import { RoundsList } from './rounds-list';
import {
  Terminal,
  Play,
  Square,
  Send,
  Bot,
  User,
  Activity,
  DollarSign,
  Cpu,
  Clock,
  Wrench,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface Feature { name: string; description: string; acceptanceCriteria: string[]; }

interface FeatureState {
  index: number;
  name: string;
  currentRound: number;
  stage: 'coder' | 'smoke' | 'evaluator' | 'idle';
  status: 'pending' | 'running' | 'passed' | 'failed';
  rounds: number;
  coderText: string;
  evaluatorText: string;
  toolCalls: ToolCallChip[];
}

interface ToolCallChip { id: string; name: string; status: 'running' | 'done' | 'error'; }

type RunState = 'idle' | 'running' | 'done' | 'aborted' | 'error';
interface RunResult { passed: number; total: number; }

type SsePayload =
  | { type: 'progress'; featureIndex: number; round: number; status: string; stage?: 'coder' | 'smoke' | 'evaluator' }
  | { type: 'coder-chunk'; featureIndex: number; delta: string }
  | { type: 'coder-tool-call'; featureIndex: number; call: { id: string; name: string } }
  | { type: 'coder-tool-result'; featureIndex: number; result: { callId: string; isError: boolean } }
  | { type: 'evaluator-chunk'; featureIndex: number; delta: string }
  | { type: 'feature_done'; featureIndex: number; rounds: number; passed: boolean }
  | { type: 'done'; results: Array<{ featureIndex: number; passed: boolean }> };

function parseSse(raw: string): SsePayload | null {
  try { return JSON.parse(raw) as SsePayload; } catch { return null; }
}

function initFeatures(features: Feature[]): FeatureState[] {
  return features.map((f, i) => ({ index: i, name: f.name, currentRound: 0, stage: 'idle', status: 'pending', rounds: 0, coderText: '', evaluatorText: '', toolCalls: [] }));
}

function applyProgress(prev: FeatureState[], featureIndex: number, round: number, stage: FeatureState['stage']): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, currentRound: round, stage, status: 'running' };
  return next;
}

function applyCoderChunk(prev: FeatureState[], featureIndex: number, delta: string): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, coderText: f.coderText + delta };
  return next;
}

function applyEvaluatorChunk(prev: FeatureState[], featureIndex: number, delta: string): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, evaluatorText: f.evaluatorText + delta };
  return next;
}

function applyToolCall(prev: FeatureState[], featureIndex: number, call: { id: string; name: string }): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, toolCalls: [...f.toolCalls, { id: call.id, name: call.name, status: 'running' }] };
  return next;
}

function applyToolResult(prev: FeatureState[], featureIndex: number, callId: string, isError: boolean): FeatureState[] {
  const next = [...prev];
  const f = next[featureIndex];
  if (f) next[featureIndex] = { ...f, toolCalls: f.toolCalls.map((tc) => tc.id === callId ? { ...tc, status: isError ? 'error' : 'done' } : tc) };
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
  } else if (ev.type === 'coder-chunk') {
    setFeatureStates((prev) => applyCoderChunk(prev, ev.featureIndex, ev.delta));
  } else if (ev.type === 'coder-tool-call') {
    setFeatureStates((prev) => applyToolCall(prev, ev.featureIndex, ev.call));
  } else if (ev.type === 'coder-tool-result') {
    setFeatureStates((prev) => applyToolResult(prev, ev.featureIndex, ev.result.callId, ev.result.isError));
  } else if (ev.type === 'evaluator-chunk') {
    setFeatureStates((prev) => applyEvaluatorChunk(prev, ev.featureIndex, ev.delta));
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
    void fetch(`/api/harness/projects/${projectId}/abort`, { method: 'POST' }).catch(() => undefined);
    setRunState('aborted');
  }, [projectId]);

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

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export interface ExecutionViewProps {
  projectId: string;
  sprintId: string;
  sprintName: string;
  features: Feature[];
  onClose: () => void;
}

interface ChatMsg {
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export function ExecutionView({ projectId, sprintId, sprintName, features, onClose }: ExecutionViewProps) {
  const { runState, featureStates, result, elapsed, error, start, abort } = useHarnessRun(projectId, sprintId, features);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState<number>(0);
  const [chatInput, setChatInput] = useState('');
  const [chatLogs, setChatLogs] = useState<Record<number, ChatMsg[]>>({});
  const [isTyping, setIsTyping] = useState(false);

  const coderScrollRef = useRef<HTMLPreElement>(null);
  const evalScrollRef = useRef<HTMLPreElement>(null);

  const doneCount = featureStates.filter((f) => f.status === 'passed' || f.status === 'failed').length;
  const progress = features.length > 0 ? Math.round((doneCount / features.length) * 100) : 0;

  // Auto-select currently running feature
  useEffect(() => {
    const runningIdx = featureStates.findIndex((f) => f.status === 'running');
    if (runningIdx !== -1) {
      setSelectedFeatureIdx(runningIdx);
    }
  }, [featureStates]);

  const selectedFeature = featureStates[selectedFeatureIdx] || featureStates[0];

  // Auto-scroll log viewers
  useEffect(() => {
    if (coderScrollRef.current) {
      coderScrollRef.current.scrollTop = coderScrollRef.current.scrollHeight;
    }
  }, [selectedFeature?.coderText]);

  useEffect(() => {
    if (evalScrollRef.current) {
      evalScrollRef.current.scrollTop = evalScrollRef.current.scrollHeight;
    }
  }, [selectedFeature?.evaluatorText]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMsg = { sender: 'user', text: chatInput.trim(), timestamp: new Date() };

    setChatLogs((prev) => {
      const current = prev[selectedFeatureIdx] || [];
      return { ...prev, [selectedFeatureIdx]: [...current, userMsg] };
    });
    setChatInput('');
    setIsTyping(true);

    // Simulate Agent response
    setTimeout(() => {
      const agentMsg: ChatMsg = {
        sender: 'agent',
        text: `Understood. I will prioritize this feedback in the next round of code review. Currently refining: "${selectedFeature?.name}".`,
        timestamp: new Date(),
      };
      setChatLogs((prev) => {
        const current = prev[selectedFeatureIdx] || [];
        return { ...prev, [selectedFeatureIdx]: [...current, agentMsg] };
      });
      setIsTyping(false);
    }, 1500);
  };

  const featureChats = chatLogs[selectedFeatureIdx] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
      {/* LEFT PANEL: Sprint Status & Feature List */}
      <Card className="lg:col-span-4 flex flex-col min-h-0">
        <CardHeader className="pb-3 border-b shrink-0 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold tracking-tight">Sprint: {sprintName}</CardTitle>
            <div className="flex items-center gap-2">
              {runState === 'running' && (
                <span className="text-xs font-mono bg-zinc-900 px-2 py-0.5 rounded text-primary">
                  {formatMs(elapsed)}
                </span>
              )}
              {runState === 'idle' && (
                <Button size="sm" onClick={start} className="gap-1">
                  <Play className="h-3 w-3" /> Run
                </Button>
              )}
              {runState === 'running' && (
                <Button size="sm" variant="destructive" onClick={abort} className="gap-1">
                  <Square className="h-3 w-3" /> Abort
                </Button>
              )}
              {(runState === 'done' || runState === 'aborted' || runState === 'error') && (
                <Button size="sm" variant="outline" onClick={start}>
                  Run again
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
            </div>
          </div>
          {runState === 'running' && (
            <div className="space-y-1.5 mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
          {result && (
            <div className={`mt-3 rounded px-3 py-2 text-xs font-medium ${result.passed === result.total ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
              {result.passed}/{result.total} features passed
            </div>
          )}
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </CardHeader>

        {/* Feature selection list */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {featureStates.map((f, idx) => (
              <button
                key={f.index}
                onClick={() => setSelectedFeatureIdx(idx)}
                className={`w-full text-left rounded-lg border p-3 text-xs transition-all flex flex-col gap-1.5 relative ${
                  selectedFeatureIdx === idx ? 'bg-primary/5 border-primary' : 'bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-semibold text-zinc-200 truncate pr-12">
                    {f.name || `Feature ${f.index + 1}`}
                  </span>
                  <Badge variant={statusBadgeVariant(f.status)} className="text-[10px] scale-90 shrink-0">
                    {f.status}
                  </Badge>
                </div>
                {f.status === 'running' && f.stage !== 'idle' && (
                  <span className="text-[10px] text-primary flex items-center gap-1 font-mono">
                    <Loader2 className="h-3 w-3 animate-spin" /> {STAGE_LABEL[f.stage]} (Round {f.currentRound})
                  </span>
                )}
                {f.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.toolCalls.map((tc) => (
                      <span
                        key={tc.id}
                        className={`text-[9px] font-mono px-1 py-0.5 rounded flex items-center gap-0.5 border ${
                          tc.status === 'running'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : tc.status === 'error'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        <Wrench className="h-2 w-2" /> {tc.name}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* RIGHT PANEL: Live Console Streams & Interactive Tabs */}
      <Card className="lg:col-span-8 flex flex-col min-h-0 bg-zinc-950 border-zinc-800">
        {selectedFeature ? (
          <Tabs defaultValue="logs" className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/40">
              <span className="text-xs font-semibold text-zinc-300 truncate">
                Console: {selectedFeature.name}
              </span>
              <TabsList className="bg-zinc-950 border border-zinc-800 h-8 scale-90">
                <TabsTrigger value="logs" className="text-xs">Live logs</TabsTrigger>
                <TabsTrigger value="history" className="text-xs">Round history</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs">HITL Chat</TabsTrigger>
              </TabsList>
            </div>

            {/* TAB: Live Logs (Dual Stream Panel) */}
            <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 p-3 m-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
                {/* Coder Stream Panel */}
                <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden min-h-0">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
                    <Terminal className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-zinc-300">Coder stream</span>
                    {selectedFeature.stage === 'coder' && (
                      <span className="ml-auto text-[10px] text-blue-400 font-mono animate-pulse">active</span>
                    )}
                  </div>
                  <pre
                    ref={coderScrollRef}
                    className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-words leading-relaxed select-text bg-zinc-950/80"
                  >
                    {selectedFeature.coderText || (
                      <span className="text-zinc-600 italic">Waiting for coder output...</span>
                    )}
                  </pre>
                </div>

                {/* Evaluator Stream Panel */}
                <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden min-h-0">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
                    <Terminal className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-300">Evaluator stream</span>
                    {selectedFeature.stage === 'evaluator' && (
                      <span className="ml-auto text-[10px] text-amber-400 font-mono animate-pulse">active</span>
                    )}
                  </div>
                  <pre
                    ref={evalScrollRef}
                    className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-words leading-relaxed select-text bg-zinc-950/80"
                  >
                    {selectedFeature.evaluatorText || (
                      <span className="text-zinc-600 italic">Waiting for evaluator feedback...</span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Metrics footer */}
              <div className="flex flex-wrap items-center gap-6 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/20 shrink-0 text-[10px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-zinc-400" /> Input/Output: ~{(selectedFeature.coderText.length / 4).toLocaleString()} tokens
                </span>
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-400" /> Est. Cost: ~${(selectedFeature.coderText.length * 0.000002).toFixed(4)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" /> Elapsed: {formatMs(elapsed)}
                </span>
              </div>
            </TabsContent>

            {/* TAB: Round History */}
            <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto p-4 m-0">
              <RoundsList sprintId={sprintId} />
            </TabsContent>

            {/* TAB: HITL Interactive Chat */}
            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 m-0">
              {/* Message Timeline */}
              <ScrollArea className="flex-1 p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-2.5 max-w-[85%] text-xs bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 text-zinc-400">
                    <Bot className="h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-semibold text-zinc-300 mb-0.5">Evaluator Agent</p>
                      <p>Use this channel to supply guidance or correct the implementation constraints for the active feature.</p>
                    </div>
                  </div>

                  {featureChats.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2.5 max-w-[85%] text-xs p-3 rounded-lg border ${
                        msg.sender === 'user'
                          ? 'ml-auto bg-primary/10 border-primary/20 text-zinc-200'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <User className="h-4 w-4 shrink-0 text-blue-400" />
                      ) : (
                        <Bot className="h-4 w-4 shrink-0 text-amber-400" />
                      )}
                      <div>
                        <p className="font-semibold text-zinc-300 mb-0.5">
                          {msg.sender === 'user' ? 'You' : 'Agent'}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic font-mono px-3">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Agent is typing...
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat Input Box */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/20 shrink-0 flex gap-2">
                <Input
                  placeholder="Provide instructions to guide the agent..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200"
                />
                <Button size="sm" onClick={handleSendChat} className="shrink-0 gap-1.5">
                  <Send className="h-3 w-3" /> Send
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-xs gap-2">
            <Terminal className="h-8 w-8 text-zinc-700" />
            <span>Select a feature from the left list to view logs.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
