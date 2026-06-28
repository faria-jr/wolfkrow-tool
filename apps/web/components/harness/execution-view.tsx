'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

import type { Feature } from './execution-run-hook';
import { useHarnessRun } from './execution-run-hook';
import { type ChatMsg, ExecutionViewShell } from './execution-view-shell';

export interface ExecutionViewProps {
  features: Feature[];
  onClose: () => void;
  projectId: string;
  sprintId: string;
  sprintName: string;
}

export function ExecutionView(props: ExecutionViewProps) {
  const run = useHarnessRun(props.projectId, props.sprintId, props.features);
  const chat = useExecutionChat(props.projectId, run.featureStates[selectedFeatureIndex(run.featureStates)]?.name);
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
function useExecutionChat(projectId: string, featureName: string | undefined) {
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
    // POST the feedback so the worker parks it for the feature's next coder round.
    void fetch(`/api/harness/projects/${projectId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureIndex: selectedFeatureIdx, text }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('feedback failed'))))
      .then(() => {
        setChatLogs((prev) =>
          appendChatMessage(prev, selectedFeatureIdx, buildAgentReply(featureName))
        );
      })
      .catch(() => {
        setChatLogs((prev) =>
          appendChatMessage(prev, selectedFeatureIdx, {
            sender: 'agent',
            text: 'Could not deliver feedback to the runner. The sprint may have finished.',
            timestamp: new Date(),
          })
        );
      })
      .finally(() => setIsTyping(false));
  };

  return { chatInput, chatLogs, isTyping, sendChat, setChatInput };
}

function appendChatMessage(logs: Record<number, ChatMsg[]>, index: number, message: ChatMsg) {
  return { ...logs, [index]: [...(logs[index] || []), message] };
}

function buildAgentReply(featureName: string | undefined): ChatMsg {
  return {
    sender: 'agent',
    text: `Feedback recorded for "${featureName ?? 'the selected feature'}". It will steer the next coder round.`,
    timestamp: new Date(),
  };
}
