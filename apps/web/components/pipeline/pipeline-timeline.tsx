'use client';

import { CheckCircle2, GitCommit, PlayCircle } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface PipelineTimelinePhase {
  stage: string;
  status: string;
}

const STAGES = [
  { id: 'discovery', label: 'Discovery', desc: 'Requirements gather & PRD' },
  { id: 'spec_build', label: 'Spec Build', desc: 'Architecture Planning' },
  { id: 'spec_validate', label: 'Spec Validate', desc: 'Quality & DOD/DOR check' },
  { id: 'design', label: 'Design', desc: 'Open Design bootstrap & collaborative UI' },
  { id: 'design_lock', label: 'Design Lock', desc: 'Snapshot, validate & freeze design artifacts' },
  { id: 'approval', label: 'Approval', desc: 'Manual or AI Gate approve' },
  { id: 'implementation', label: 'Implementation', desc: 'Epic planning & scaffolding' },
];

export function PipelineTimeline({
  onSelectStage,
  phases,
  selectedStage,
}: {
  onSelectStage: (stage: string) => void;
  phases: PipelineTimelinePhase[];
  selectedStage: string;
}) {
  return (
    <Card className="flex min-h-0 flex-col border-zinc-800 bg-zinc-950 lg:col-span-3">
      <CardHeader className="shrink-0 border-b border-zinc-800 bg-zinc-900/20 pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Timeline stages
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 p-3">
        <div className="relative mt-2 flex flex-col gap-6 border-l border-zinc-800 pl-4">
          {STAGES.map((stage) => (
            <TimelineStageButton
              key={stage.id}
              onSelectStage={onSelectStage}
              phase={phases.find((phase) => phase.stage === stage.id)}
              selectedStage={selectedStage}
              stage={stage}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function TimelineStageButton({
  onSelectStage,
  phase,
  selectedStage,
  stage,
}: {
  onSelectStage: (stage: string) => void;
  phase: PipelineTimelinePhase | undefined;
  selectedStage: string;
  stage: { desc: string; id: string; label: string };
}) {
  const status = getTimelineStatus(phase, selectedStage === stage.id);

  return (
    <button
      className="group relative flex w-full flex-col gap-1 text-left transition-all focus:outline-none"
      onClick={() => onSelectStage(stage.id)}
    >
      <TimelineDot status={status} />
      <span className={`text-xs font-semibold ${timelineLabelClass(status)}`}>{stage.label}</span>
      <span className="text-muted-foreground line-clamp-1 text-xs font-normal">{stage.desc}</span>
    </button>
  );
}

type TimelineStatus = 'completed' | 'idle' | 'running' | 'selected';

function getTimelineStatus(
  phase: PipelineTimelinePhase | undefined,
  selected: boolean
): TimelineStatus {
  if (selected) return 'selected';
  if (phase?.status === 'completed' || phase?.status === 'done') return 'completed';
  if (phase?.status === 'running' || phase?.status === 'starting') return 'running';
  return 'idle';
}

function TimelineDot({ status }: { status: TimelineStatus }) {
  return (
    <div className={`absolute -left-6 top-1 rounded-full border p-0.5 ${timelineDotClass(status)}`}>
      {status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
      {status === 'running' && <PlayCircle className="h-3.5 w-3.5" />}
      {(status === 'idle' || status === 'selected') && <GitCommit className="h-3.5 w-3.5" />}
    </div>
  );
}

function timelineDotClass(status: TimelineStatus) {
  const classes: Record<TimelineStatus, string> = {
    completed: 'border-green-400 bg-green-500 text-white',
    idle: 'border-zinc-800 bg-zinc-950 text-zinc-600',
    running: 'animate-spin border-amber-400 bg-amber-500 text-white',
    selected: 'animate-pulse border-blue-400 bg-blue-500 text-white',
  };
  return classes[status];
}

function timelineLabelClass(status: TimelineStatus) {
  if (status === 'selected') return 'text-primary';
  if (status === 'completed') return 'text-zinc-200 group-hover:text-zinc-100';
  return 'text-zinc-500 group-hover:text-zinc-400';
}
