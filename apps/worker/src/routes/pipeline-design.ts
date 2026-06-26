/**
 * EPIC 4.2d — Open Design phase handlers for the pipeline.
 *
 * Extracted from routes/pipeline.ts (file-size limit). The `design` stage
 * bootstraps an OD session tied to the pipeline project; `design_lock`
 * captures + validates + freezes the design artifacts. Both delegate to the
 * open-design module (bootstrap/lock) against the running engine's daemon.
 */

import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ImplementViaHarnessUseCase } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getArtifactWriter, getHarnessAgents, getRepos } from '../container';
import { bootstrapDesignSession, sanitizeOdProjectId } from '../open-design/bootstrap';
import { OpenDesignClient } from '../open-design/client';
import { lockDesign } from '../open-design/lock';
import { openDesignManager } from '../open-design/manager';
import { validate, z } from '../validation';

const runPhaseBody = z.object({
  userPrompt: z.string().max(200_000).optional(),
  model: z.string().max(128).optional(),
});

type RunParams = { id: string; phaseId: string };

/** implementation stage: delegate to the Harness (creates Harness project + sprints). */
export async function runImplementationViaHarness(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply,
): Promise<unknown> {
  const r = getRepos();
  const body = validate(runPhaseBody, req.body ?? {});
  try {
    const { planner } = await getHarnessAgents({ maxRoundsPerFeature: 5, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' });
    const result = await new ImplementViaHarnessUseCase({
      pipelineProjectRepo: r.pipelineProject,
      pipelinePhaseRepo: r.pipelinePhase,
      harnessProjectRepo: r.harnessProject,
      harnessSprintRepo: r.harnessSprint,
      planner,
      artifactWriter: getArtifactWriter(),
    }).execute({
      projectId: req.params.id,
      phaseId: req.params.phaseId,
      ...(body.userPrompt !== undefined ? { inlineSpec: body.userPrompt } : {}),
    });
    return {
      phase: result.phase.toProps(),
      project: result.pipeline.toProps(),
      output: result.artifact,
      harnessProjectId: result.harness.toProps().id,
      sprintCount: result.sprints.length,
    };
  } catch (err) {
    req.log.error({ err }, 'ImplementViaHarnessUseCase failed');
    return reply.status(500).send({ error: 'Implementation via Harness failed' });
  }
}

/** Returns the daemon client + web URL, or sends 409 when the engine isn't up. */
function engineClientOr409(reply: FastifyReply): { client: OpenDesignClient; webUrl: string } | null {
  const { daemonUrl, webUrl, status } = openDesignManager.getState();
  if (status !== 'running' || !daemonUrl || !webUrl) {
    reply.status(409).send({ error: 'Open Design engine is not running — start it first' });
    return null;
  }
  return { client: new OpenDesignClient(daemonUrl), webUrl };
}

async function readSpec(specPath: string | undefined): Promise<string> {
  if (!specPath) return '';
  try {
    return await readFile(specPath, 'utf8');
  } catch {
    return '';
  }
}

/** design stage: bootstrap an OD session tied to this pipeline project. */
export async function runDesignBootstrap(req: FastifyRequest<{ Params: RunParams }>, reply: FastifyReply): Promise<unknown> {
  const r = getRepos();
  const project = await r.pipelineProject.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Not found' });
  const phase = await r.pipelinePhase.findById(req.params.phaseId);
  const engine = engineClientOr409(reply);
  if (!engine) return undefined;

  const result = await bootstrapDesignSession(engine.client, {
    wolfkrowProjectId: project.id,
    name: project.name,
    specContent: await readSpec(project.specPath),
    webUrl: engine.webUrl,
  });
  return {
    phase: phase?.toProps(),
    project: project.toProps(),
    studioUrl: result.studioUrl,
    openDesignProjectId: result.openDesignProjectId,
  };
}

/** design_lock stage: capture + validate + freeze the design artifacts. */
export async function runDesignLock(req: FastifyRequest<{ Params: RunParams }>, reply: FastifyReply): Promise<unknown> {
  const r = getRepos();
  const project = await r.pipelineProject.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Not found' });
  const phase = await r.pipelinePhase.findById(req.params.phaseId);
  const engine = engineClientOr409(reply);
  if (!engine) return undefined;

  const outputDir = join(process.env['WOLFKROW_DESIGN_DIR'] ?? tmpdir(), 'wolfkrow-design', project.id);
  const result = await lockDesign({
    client: engine.client,
    odProjectId: sanitizeOdProjectId(project.id),
    outputDir,
  });
  return { phase: phase?.toProps(), project: project.toProps(), lock: result, designDir: outputDir };
}
