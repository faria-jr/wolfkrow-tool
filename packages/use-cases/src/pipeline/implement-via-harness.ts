import type {
  ArtifactWriter,
  HarnessProjectRepo,
  HarnessSprint,
  HarnessSprintRepo,
  PipelinePhase,
  PipelinePhaseRepo,
  PipelineProject,
  PipelineProjectRepo,
} from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import {
  CreateHarnessProjectUseCase,
  type CreateHarnessProjectOutput,
} from '../harness/create-harness-project';
import { PlanSprintsUseCase, type HarnessPlanner } from '../harness/plan-sprints';

/**
 * - Bridge the Pipeline's `implementation` phase into the Harness.
 *
 * The flow:
 * 1. Look up the pipeline project + the latest `implementation` phase.
 * 2. Resolve the spec to run the harness against - prefer the user's
 * `specEdits` () when present, otherwise fall back to the
 * `specPath` on disk, otherwise inline the discovery notes + name +
 * description (better than nothing).
 * 3. Create a Harness project via {@link CreateHarnessProjectUseCase}.
 * 4. Plan sprints via {@link PlanSprintsUseCase} (Planner AI).
 * 5. Persist the harness project ID on the pipeline project so the UI
 * can deep-link from the pipeline report into the harness view.
 * 6. Mark the phase as completed with a Markdown artifact summarising
 * the harness project + sprints (the actual coding loop runs
 * out-of-band via POST /harness/projects/:id/run).
 *
 * The artifact text becomes the `implementation` phase's `artifactPath`
 * equivalent: it lives in the message repo so {@link GeneratePipelineReportUseCase}
 * picks it up. We don't run the harness loop synchronously - that would
 * block the request for minutes. Instead, the artifact records the
 * harness plan and the run is triggered separately via the harness routes.
 */
export interface ImplementViaHarnessInput {
  projectId: string;
  phaseId: string;
  /** Optional inline spec text; takes precedence over specEdits + specPath. */
  inlineSpec?: string;
  /** Model used by the harness Planner for sprint generation. */
  plannerModel?: string;
}

export interface ImplementViaHarnessOutput {
  pipeline: PipelineProject;
  phase: PipelinePhase;
  artifact: string;
  harness: CreateHarnessProjectOutput['project'];
  sprints: HarnessSprint[];
}

export interface ImplementViaHarnessOptions {
  /** Optional override for reading the spec from disk (tests inject one). */
  readSpec?: (specPath: string) => Promise<string>;
}

const SYSTEM_USER_ID = 'system';

export interface ImplementViaHarnessDeps {
  pipelineProjectRepo: PipelineProjectRepo;
  pipelinePhaseRepo: PipelinePhaseRepo;
  harnessProjectRepo: HarnessProjectRepo;
  harnessSprintRepo: HarnessSprintRepo;
  planner: HarnessPlanner;
  artifactWriter?: ArtifactWriter;
}

export class ImplementViaHarnessUseCase {
  private readonly readSpec: (specPath: string) => Promise<string>;

  constructor(deps: ImplementViaHarnessDeps, options: ImplementViaHarnessOptions = {}) {
    this.pipelineProjectRepo = deps.pipelineProjectRepo;
    this.pipelinePhaseRepo = deps.pipelinePhaseRepo;
    this.harnessProjectRepo = deps.harnessProjectRepo;
    this.harnessSprintRepo = deps.harnessSprintRepo;
    this.planner = deps.planner;
    if (deps.artifactWriter) this.artifactWriter = deps.artifactWriter;
    this.readSpec =
      options.readSpec ??
      (async (specPath: string) => {
        const fs = await import('node:fs/promises');
        try {
          return await fs.readFile(specPath, 'utf8');
        } catch {
          return '';
        }
      });
  }

  private pipelineProjectRepo: PipelineProjectRepo;
  private pipelinePhaseRepo: PipelinePhaseRepo;
  private harnessProjectRepo: HarnessProjectRepo;
  private harnessSprintRepo: HarnessSprintRepo;
  private planner: HarnessPlanner;
  private artifactWriter?: ArtifactWriter;

  async execute(input: ImplementViaHarnessInput): Promise<ImplementViaHarnessOutput> {
    const [project, phase] = await Promise.all([
      this.pipelineProjectRepo.findById(input.projectId),
      this.pipelinePhaseRepo.findById(input.phaseId),
    ]);
    if (!project) throw new NotFoundError('PipelineProject', input.projectId);
    if (!phase) throw new NotFoundError('PipelinePhase', input.phaseId);

    return this.runImplementation(project, phase, input);
  }

  private async runImplementation(
    project: PipelineProject,
    phase: PipelinePhase,
    input: ImplementViaHarnessInput
  ): Promise<ImplementViaHarnessOutput> {
    const spec = await this.resolveSpec(project, input.inlineSpec);
    const harnessSpecPath = await this.materializeSpecPath(project.id, project.specPath, spec);
    const harnessProject = await this.createHarnessProject(project, harnessSpecPath);
    const sprints = await this.planHarnessSprints(harnessProject.id, spec);
    const artifact = this.renderArtifact({
      pipelineName: project.name,
      harnessProjectId: harnessProject.id,
      specLength: spec.length,
      sprintCount: sprints.length,
      sprints: sprints.map((s) => ({
        number: s.toProps().number,
        name: s.toProps().name,
        featureCount: s.toProps().features.length,
      })),
    });
    const updatedPipeline = await this.pipelineProjectRepo.save(
      project.withStage('completed', {
        status: 'completed',
        harnessProjectId: harnessProject.id,
        completedAt: new Date(),
      })
    );
    const completedPhase = await this.pipelinePhaseRepo.save(
      phase.complete(`harness:${phase.id}`, artifact.length)
    );
    return {
      pipeline: updatedPipeline,
      phase: completedPhase,
      artifact,
      harness: harnessProject,
      sprints,
    };
  }

  private async createHarnessProject(project: PipelineProject, specPath: string) {
    const useCase = new CreateHarnessProjectUseCase(this.harnessProjectRepo);
    const input: Parameters<typeof useCase.execute>[0] = {
      userId: project.userId,
      name: project.name,
      specPath,
    };
    if (project.description !== undefined) input.description = project.description;
    if (project.projectPath !== undefined) input.projectPath = project.projectPath;
    const { project: harnessProject } = await useCase.execute(input);
    return harnessProject;
  }

  private async planHarnessSprints(
    harnessProjectId: string,
    specContent: string
  ): Promise<HarnessSprint[]> {
    const useCase = new PlanSprintsUseCase(
      this.harnessProjectRepo,
      this.harnessSprintRepo,
      this.planner
    );
    const { sprints } = await useCase.execute({ projectId: harnessProjectId, specContent });
    return sprints;
  }

  private async resolveSpec(project: PipelineProject, inlineSpec?: string): Promise<string> {
    if (inlineSpec && inlineSpec.trim().length > 0) return inlineSpec;
    if (project.specEdits && project.specEdits.trim().length > 0) return project.specEdits;
    if (project.specPath) {
      const fromDisk = await this.readSpec(project.specPath);
      if (fromDisk.length > 0) return fromDisk;
    }
    const parts: string[] = [`# ${project.name}`];
    if (project.description) parts.push(project.description);
    if (project.discoveryNotes) parts.push(`## Discovery Notes\n\n${project.discoveryNotes}`);
    return parts.join('\n\n');
  }

  /**
   * Resolve a real on-disk path the harness can read from. Reuses the
   * pipeline project's `specPath` when it exists; otherwise writes the
   * spec to a stable location via `artifactWriter` (falls back to an
   * inline placeholder if no writer is wired - the planner still receives
   * `specContent` directly, so the plan artifact is unaffected).
   */
  private async materializeSpecPath(
    projectId: string,
    existingSpecPath: string | undefined,
    spec: string
  ): Promise<string> {
    if (existingSpecPath) return existingSpecPath;
    if (this.artifactWriter) {
      return this.artifactWriter.write(`${projectId}/spec`, spec);
    }
    // No artifact writer: spec is embedded in sprints via specContent passed to
    // planHarnessSprints. Return empty string so the harness doesn't attempt to
    // read a non-existent file path.
    return '';
  }

  private renderArtifact(input: {
    pipelineName: string;
    harnessProjectId: string;
    specLength: number;
    sprintCount: number;
    sprints: Array<{ number: number; name: string; featureCount: number }>;
  }): string {
    const lines: string[] = [
      `# Implementation - ${input.pipelineName}`,
      '',
      `Harness project: \`${input.harnessProjectId}\``,
      `Spec size: ${input.specLength} characters`,
      `Sprints planned: ${input.sprintCount}`,
      '',
      '## Sprints',
      '',
    ];
    for (const sprint of input.sprints) {
      lines.push(`### Sprint ${sprint.number}: ${sprint.name}`);
      lines.push(`Features: ${sprint.featureCount}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
    lines.push('Run the harness loop to actually generate code:');
    lines.push('```bash');
    lines.push(`curl -X POST /harness/projects/${input.harnessProjectId}/run`);
    lines.push('```');
    return lines.join('\n');
  }
}

// Re-export to keep module self-contained for downstream consumers.
export type { CreateHarnessProjectOutput } from '../harness/create-harness-project';

// Avoid an "unused" lint warning on the SYSTEM_USER_ID helper; reserved for a
// future "owner" model where the harness can be created under a service user
// instead of the pipeline owner.
void SYSTEM_USER_ID;
