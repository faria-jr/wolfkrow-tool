'use client';

import { Loader2, Wrench } from 'lucide-react';

import type { FeatureState, RunState, ToolCallChip } from './execution-run-hook';
import { formatMs, STAGE_LABEL } from './execution-run-hook';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { statusBadgeVariant } from '@/lib/status-badge';

export interface HarnessSidebarProps {
  abort: () => void;
  elapsed: number;
  error: string | null;
  featureStates: FeatureState[];
  onClose: () => void;
  onFeatureSelect: (index: number) => void;
  progress: number;
  result: { passed: number; total: number } | null;
  runState: RunState;
  selectedFeatureIdx: number;
  sprintName: string;
  start: () => void;
}

export function HarnessSidebar(props: HarnessSidebarProps) {
  return (
    <Card className="flex min-h-0 flex-col lg:col-span-4">
      <SprintHeader {...props} />
      <FeatureSelector
        featureStates={props.featureStates}
        onFeatureSelect={props.onFeatureSelect}
        selectedFeatureIdx={props.selectedFeatureIdx}
      />
    </Card>
  );
}

function SprintHeader(props: HarnessSidebarProps) {
  return (
    <CardHeader className="bg-muted/20 shrink-0 border-b pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold tracking-tight">
          Sprint: {props.sprintName}
        </CardTitle>
        <SprintActions {...props} />
      </div>
      {props.runState === 'running' && (
        <ProgressBlock elapsed={props.elapsed} progress={props.progress} />
      )}
      {props.result && <ResultBanner result={props.result} />}
      {props.error && <p className="text-destructive mt-3 text-xs">{props.error}</p>}
    </CardHeader>
  );
}

function SprintActions(props: HarnessSidebarProps) {
  return (
    <div className="flex items-center gap-2">
      {props.runState === 'running' && (
        <span className="text-primary rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs">
          {formatMs(props.elapsed)}
        </span>
      )}
      <RunButton abort={props.abort} runState={props.runState} start={props.start} />
      <Button size="sm" variant="ghost" onClick={props.onClose}>
        x
      </Button>
    </div>
  );
}

function RunButton({
  abort,
  runState,
  start,
}: {
  abort: () => void;
  runState: RunState;
  start: () => void;
}) {
  if (runState === 'idle')
    return (
      <Button size="sm" onClick={start}>
        Run
      </Button>
    );
  if (runState === 'running')
    return (
      <Button size="sm" variant="destructive" onClick={abort}>
        Abort
      </Button>
    );
  return (
    <Button size="sm" variant="outline" onClick={start}>
      Run again
    </Button>
  );
}

function ProgressBlock({ elapsed, progress }: { elapsed: number; progress: number }) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>Overall Progress</span>
        <span>
          {progress}% - {formatMs(elapsed)}
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}

function ResultBanner({ result }: { result: { passed: number; total: number } }) {
  const passed = result.passed === result.total;
  return (
    <div
      className={`mt-3 rounded px-3 py-2 text-xs font-medium ${passed ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}
    >
      {result.passed}/{result.total} features passed
    </div>
  );
}

function FeatureSelector({
  featureStates,
  onFeatureSelect,
  selectedFeatureIdx,
}: {
  featureStates: FeatureState[];
  onFeatureSelect: (index: number) => void;
  selectedFeatureIdx: number;
}) {
  return (
    <ScrollArea className="flex-1 p-3">
      <div className="space-y-2">
        {featureStates.map((feature, index) => (
          <FeatureButton
            feature={feature}
            key={feature.index}
            onSelect={() => onFeatureSelect(index)}
            selected={selectedFeatureIdx === index}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function FeatureButton({
  feature,
  onSelect,
  selected,
}: {
  feature: FeatureState;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      className={`relative flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left text-xs transition-all ${selected ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50'}`}
      onClick={onSelect}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate pr-12 font-semibold text-zinc-200">
          {feature.name || `Feature ${feature.index + 1}`}
        </span>
        <Badge variant={statusBadgeVariant(feature.status)} className="shrink-0 text-xs">
          {feature.status}
        </Badge>
      </div>
      {feature.status === 'running' && feature.stage !== 'idle' && (
        <RunningFeatureMeta feature={feature} />
      )}
      {feature.toolCalls.length > 0 && <ToolCallChips toolCalls={feature.toolCalls} />}
    </button>
  );
}

function RunningFeatureMeta({ feature }: { feature: FeatureState }) {
  return (
    <span className="text-primary flex items-center gap-1 font-mono text-xs">
      <Loader2 className="h-3 w-3 animate-spin" /> {STAGE_LABEL[feature.stage]} (Round{' '}
      {feature.currentRound})
    </span>
  );
}

function ToolCallChips({ toolCalls }: { toolCalls: ToolCallChip[] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {toolCalls.map((toolCall) => (
        <ToolCallChipView key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}

function ToolCallChipView({ toolCall }: { toolCall: ToolCallChip }) {
  return (
    <span
      className={`flex items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-xs ${toolCallClass(toolCall.status)}`}
    >
      <Wrench className="h-2 w-2" /> {toolCall.name}
    </span>
  );
}

function toolCallClass(status: ToolCallChip['status']) {
  if (status === 'running') return 'border-amber-500/20 bg-amber-500/10 text-amber-500';
  if (status === 'error') return 'border-red-500/20 bg-red-500/10 text-red-500';
  return 'border-zinc-700 bg-zinc-800 text-zinc-400';
}
