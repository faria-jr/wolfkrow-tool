'use client';

import type React from 'react';

import { HarnessConsole } from './execution-console';
import type { FeatureState, RunState } from './execution-run-hook';
import { HarnessSidebar } from './execution-sidebar';

export interface ChatMsg {
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

interface ExecutionViewShellProps {
  abort: () => void;
  chatInput: string;
  coderScrollRef: React.RefObject<HTMLPreElement | null>;
  elapsed: number;
  error: string | null;
  evalScrollRef: React.RefObject<HTMLPreElement | null>;
  featureChats: ChatMsg[];
  featureStates: FeatureState[];
  isTyping: boolean;
  onChatInputChange: (value: string) => void;
  onClose: () => void;
  onFeatureSelect: (index: number) => void;
  onSendChat: () => void;
  progress: number;
  result: { passed: number; total: number } | null;
  runState: RunState;
  selectedFeature: FeatureState | undefined;
  selectedFeatureIdx: number;
  sprintId: string;
  sprintName: string;
  start: () => void;
}

export function ExecutionViewShell(props: ExecutionViewShellProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-12">
      <HarnessSidebar
        abort={props.abort}
        elapsed={props.elapsed}
        error={props.error}
        featureStates={props.featureStates}
        onClose={props.onClose}
        onFeatureSelect={props.onFeatureSelect}
        progress={props.progress}
        result={props.result}
        runState={props.runState}
        selectedFeatureIdx={props.selectedFeatureIdx}
        sprintName={props.sprintName}
        start={props.start}
      />
      <HarnessConsole
        chatInput={props.chatInput}
        coderScrollRef={props.coderScrollRef}
        elapsed={props.elapsed}
        evalScrollRef={props.evalScrollRef}
        featureChats={props.featureChats}
        isTyping={props.isTyping}
        onChatInputChange={props.onChatInputChange}
        onSendChat={props.onSendChat}
        selectedFeature={props.selectedFeature}
        sprintId={props.sprintId}
      />
    </div>
  );
}
