/**
 * M5.4 — Pipeline phase execution kinds.
 *
 * Each pipeline stage (discovery, spec_build, etc.) has an associated
 * `PhaseKind` that drives how the orchestrator behaves at runtime:
 *
 * - `auto`: Run end-to-end without human interaction. Default for discovery,
 *   spec_build, spec_validate, implementation.
 * - `conversation`: Pause for user approval / edits after the AI step.
 *   Used for the `approval` stage. The use-case transitions the phase to
 *   `awaiting_user`; a separate call (ApprovePhaseUseCase) advances the
 *   pipeline.
 * - `loop`: Iterate the stage until a completion criterion is met
 *   (e.g. Evaluator passes). Used when the implementation stage is wired
 *   into the Harness Coder→Evaluator loop.
 */
export type PhaseKind = 'auto' | 'conversation' | 'loop';

const STAGE_KINDS: Readonly<Record<PipelineStage, PhaseKind>> = {
  discovery: 'auto',
  spec_build: 'auto',
  spec_validate: 'auto',
  approval: 'conversation',
  implementation: 'auto',
  completed: 'auto',
};

export function phaseKindFor(stage: PipelineStage): PhaseKind {
  return STAGE_KINDS[stage];
}

import type { PipelineStage } from './pipeline-project';
