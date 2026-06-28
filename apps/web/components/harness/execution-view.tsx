'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

import type { Feature } from './execution-run-hook';
import { useHarnessRun } from './execution-run-hook';
import { type ChatMsg, ExecutionViewShell } from './execution-view-shell';

export interface ExecutionViewProps {
  autoplay?: boolean;
  features: Feature[];
  onClose: () => void;
  projectId: string;
  sprintId: string;
  sprintName: string;
}

export function ExecutionView(props: ExecutionViewProps) {
  const run = useHarnessRun(props.projectId, props.sprintId, props.features);
  const chat = useExecutionChat(
    props.projectId,
    run.featureStates[selectedFeatureIndex(run.featureStates)]?.name,
    () => run.featureStates[selectedFeatureIdx]?.coderText ?? undefined
  );

  useEffect(() => {
    if (props.autoplay && run.runState === 'idle') run.start();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState<number>(0);
  const coderScrollRef = useRef<HTMLPreElement>(null);
  const evalScrollRef = useRef<HTMLPreElement>(null);

  useAutoSelectRunningFeature(run.featureStates, setSelectedFeatureIdx);
  useAutoScrollLog(coderScrollRef, run.featureStates[selectedFeatureIdx]?.coderText);
  useAutoScrollLog(evalScrollRef, run.featureStates[selectedFeatureIdx]?.evaluatorText);

  const doneCount = run.featureStates.filter(
    (feature) => feature.status === 'passed' || feature.status === 'failed'
  ).length;
  const progress =
    props.features.length > 0 ? Math.round((doneCount / props.features.length) * 100) : 0;

  return (
    <ExecutionViewShell
      abort={run.abort}
      chatInput={chat.chatInput}
      coderScrollRef={coderScrollRef}
      elapsed={run.elapsed}
      error={run.error}
      evalScrollRef={evalScrollRef}
      featureChats={chat.chatLogs[selectedFeatureIdx] || []}
      featureStates={run.featureStates}
      isTyping={chat.isTyping}
      onChatInputChange={chat.setChatInput}
      onClose={props.onClose}
      onFeatureSelect={setSelectedFeatureIdx}
      onSendChat={() => chat.sendChat(selectedFeatureIdx)}
      progress={progress}
      result={run.result}
      runState={run.runState}
      selectedFeature={run.featureStates[selectedFeatureIdx] || run.featureStates[0]}
      selectedFeatureIdx={selectedFeatureIdx}
      sprintId={props.sprintId}
      sprintName={props.sprintName}
      start={run.start}
    />
  );
}

function selectedFeatureIndex(features: Array<{ status: string }>) {
  const runningIdx = features.findIndex((feature) => feature.status === 'running');
  return runningIdx === -1 ? 0 : runningIdx;
}

function useAutoSelectRunningFeature(
  featureStates: Array<{ status: string }>,
  setSelectedFeatureIdx: (index: number) => void
) {
  useEffect(() => {
    const runningIdx = featureStates.findIndex((feature) => feature.status === 'running');
    if (runningIdx !== -1) setSelectedFeatureIdx(runningIdx);
  }, [featureStates, setSelectedFeatureIdx]);
}

function useAutoScrollLog(ref: React.RefObject<HTMLPreElement | null>, text: string | undefined) {
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [ref, text]);
}

/**
 * Harness HITL chat — sends operator feedback to the worker, which parks it and
 * drains it into the next coder round for the selected feature (real feedback
 * loop, not a mock). The feature index maps to the harness feature being run.
 */
function useExecutionChat(
  projectId: string,
  featureName: string | undefined,
  getCoderText: () => string | undefined
) {
  const [chatInput, setChatInput] = useState('');
  const [chatLogs, setChatLogs] = useState<Record<number, ChatMsg[]>>({});
  const [isTyping, setIsTyping] = useState(false);

  const sendChat = (selectedFeatureIdx: number) => {
    const text = chatInput.trim();
    if (!text) return;

    setChatLogs((prev) =>
      appendChatMessage(prev, selectedFeatureIdx, { sender: 'user', text, timestamp: new Date() })
    );
    setChatInput('');
    setIsTyping(true);

    const latestCoderForFeature = getCoderText();

    // F2.1 — conversational HITL: stream a real LLM reply grounded in the
    // sprint context. Falls back to the feedback channel if the stream fails.
    void consumeHarnessChat({
        projectId,
        text,
        selectedFeatureIdx,
        latestCoderOutput: latestCoderForFeature,
        featureName,
        setChatLogs,
      })
      .catch(() => {
        setChatLogs((prev) =>
          appendChatMessage(prev, selectedFeatureIdx, {
            sender: 'agent',
            text: 'Could not reach the runner. The sprint may have finished — your message was not delivered.',
            timestamp: new Date(),
          })
        );
      })
      .finally(() => setIsTyping(false));
  };

  return { chatInput, chatLogs, isTyping, sendChat, setChatInput };
}

interface ConsumeChatOptions {
  projectId: string;
  text: string;
  selectedFeatureIdx: number;
  latestCoderOutput: string | undefined;
  featureName: string | undefined;
  setChatLogs: React.Dispatch<React.SetStateAction<Record<number, ChatMsg[]>>>;
}

/** F2.1 — consume the sprint-chat SSE stream, appending deltas live. */
async function consumeHarnessChat(opts: ConsumeChatOptions): Promise<void> {
  const res = await fetch(`/api/harness/projects/${opts.projectId}/sprint-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: opts.text,
      featureIndex: opts.selectedFeatureIdx,
      ...(opts.latestCoderOutput ? { latestCoderOutput: opts.latestCoderOutput } : {}),
    }),
  });
  if (!res.ok || !res.body) throw new Error('chat stream failed');

  // Append deltas live as the agent replies.
  let acc = '';
  opts.setChatLogs((prev) =>
    appendChatMessage(prev, opts.selectedFeatureIdx, {
      sender: 'agent',
      text: '',
      timestamp: new Date(),
    })
  );
  for await (const line of readSseLines(res.body)) {
    appendChatDelta(line, opts.selectedFeatureIdx, opts.setChatLogs, (delta) => {
      acc += delta;
    });
  }
  if (!acc) {
    opts.setChatLogs((prev) =>
      replaceLastAgentMessage(
        prev,
        opts.selectedFeatureIdx,
        `Feedback recorded for "${opts.featureName ?? 'the selected feature'}". It will steer the next coder round.`
      )
    );
  }
}

/** Parse a text-delta SSE line and accumulate it (keeps nesting ≤ 3). */
function appendChatDelta(
  line: string,
  selectedFeatureIdx: number,
  setChatLogs: React.Dispatch<React.SetStateAction<Record<number, ChatMsg[]>>>,
  accumulate: (delta: string) => void
): void {
  const evt = parseChatEvent(line);
  if (evt?.type !== 'text' || !evt.content) return;
  const delta = evt.content;
  accumulate(delta);
  setChatLogs((prev) => {
    const thread = prev[selectedFeatureIdx] ? [...prev[selectedFeatureIdx]] : [];
    const last = thread[thread.length - 1];
    const text = last?.text ? last.text + delta : delta;
    if (last && last.sender === 'agent') {
      thread[thread.length - 1] = { sender: 'agent', text, timestamp: last.timestamp };
    } else {
      thread.push({ sender: 'agent', text, timestamp: new Date() });
    }
    return { ...prev, [selectedFeatureIdx]: thread };
  });
}

function appendChatMessage(logs: Record<number, ChatMsg[]>, index: number, message: ChatMsg) {
  return { ...logs, [index]: [...(logs[index] || []), message] };
}

/** Replace the last agent message for a feature (live delta accumulation). */
function replaceLastAgentMessage(
  logs: Record<number, ChatMsg[]>,
  index: number,
  text: string
): Record<number, ChatMsg[]> {
  const thread = logs[index] ? [...logs[index]] : [];
  const last = thread[thread.length - 1];
  if (last && last.sender === 'agent') {
    thread[thread.length - 1] = { sender: 'agent', text, timestamp: last.timestamp };
  } else {
    thread.push({ sender: 'agent', text, timestamp: new Date() });
  }
  return { ...logs, [index]: thread };
}

/** Async-iterate SSE `data:` lines from a ReadableStream. */
async function* readSseLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      yield* lines.map(parseDataLine).filter((d): d is string => d !== null);
    }
    const tail = parseDataLine(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** Extract the `data:` payload from an SSE line, or null if not a data line. */
function parseDataLine(line: string): string | null {
  return line.startsWith('data: ') ? line.slice(6) : null;
}

function parseChatEvent(raw: string): { type: string; content?: string } | null {
  try {
    return JSON.parse(raw) as { type: string; content?: string };
  } catch {
    return null;
  }
}
