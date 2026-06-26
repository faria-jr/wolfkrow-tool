'use client';

import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/lib/status-badge';

/**
 * EPIC 4.2e — Progress tracker for an Open Design session bootstrap.
 *
 * Presentational port (minimal) of LionClaw BootstrappingView. LionClaw drives
 * bootstrap via window.lionclaw IPC and renders streamed events; Wolfkrow keeps
 * this component stateless — the parent owns the `stage` string and passes it
 * down. The 9-stage list mirrors LionClaw's canonical STEPS so the UX matches.
 */

/** Canonical bootstrap stages, in order (ported from LionClaw STEPS). */
export const BOOTSTRAP_STAGES = [
  { id: 'run-dir', label: 'Preparing session folder' },
  { id: 'prompt', label: 'Reading design brief' },
  { id: 'sidecar', label: 'Starting sidecar' },
  { id: 'od-config', label: 'Syncing agent and model' },
  { id: 'od-project', label: 'Creating Open Design project' },
  { id: 'conversation', label: 'Creating conversation' },
  { id: 'prompt-injection', label: 'Injecting initial prompt' },
  { id: 'prompt-verification', label: 'Confirming delivery in chat' },
  { id: 'studio', label: 'Opening Open Design' },
] as const;

export type BootstrapStageId = (typeof BOOTSTRAP_STAGES)[number]['id'];

interface BootstrappingViewProps {
  /** Id of the currently active stage. Empty string => all pending. */
  stage: string;
  /** Optional error message; when set the list renders a destructive alert. */
  error?: string;
}

type StepStatus = 'pending' | 'running' | 'done' | 'error';

function resolveStatus(stageId: string, currentStage: string, hasError: boolean): StepStatus {
  if (hasError && stageId === currentStage) return 'error';
  const order = BOOTSTRAP_STAGES.map((s) => s.id);
  const currentIdx = order.indexOf(currentStage as BootstrapStageId);
  const thisIdx = order.indexOf(stageId as BootstrapStageId);
  if (currentIdx === -1) return 'pending';
  if (thisIdx < currentIdx) return 'done';
  if (thisIdx === currentIdx) return 'running';
  return 'pending';
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (status === 'running') return <Loader2 className="size-4 shrink-0 animate-spin text-yellow-500" />;
  if (status === 'error') return <AlertTriangle className="size-4 shrink-0 text-destructive" />;
  return <Circle className="size-4 shrink-0 text-muted-foreground" />;
}

export function BootstrappingView({ stage, ...rest }: BootstrappingViewProps) {
  const hasError = rest.error !== undefined && rest.error !== '';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Preparing Open Design</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {BOOTSTRAP_STAGES.map((step) => {
            const status = resolveStatus(step.id, stage, hasError);
            const isCurrent = status === 'running' || status === 'error';
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex items-center gap-2 text-sm"
              >
                <StepIcon status={status} />
                <span
                  className={
                    status === 'running'
                      ? 'font-medium text-foreground'
                      : status === 'done'
                        ? 'text-muted-foreground'
                        : status === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                  }
                >
                  {step.label}
                </span>
                <StatusBadge status={status} className="ml-auto" />
              </li>
            );
          })}
        </ol>
        {rest.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">{rest.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
