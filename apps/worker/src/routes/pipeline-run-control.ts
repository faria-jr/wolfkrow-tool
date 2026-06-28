/**
 * Pipeline phase run-control handlers — server-side abort/pause/resume/state
 * for an in-flight AI phase. Mirrors the Harness run registry via the shared
 * run-control module so the expensive AI loop actually stops, not just the SSE
 * consumer. Extracted from pipeline.ts to keep the route module under the size
 * limit.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { abortRun, pauseRun, resumeRun, runState } from '../lib/run-control';

type RunParams = { id: string; phaseId: string };

/** POST /projects/:id/phases/:phaseId/abort — stop the in-flight phase run. */
export async function abortPhaseHandler(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply
): Promise<unknown> {
  return reply.send({ ok: abortRun(req.params.phaseId) });
}

/** POST /projects/:id/phases/:phaseId/pause — pause the in-flight phase run. */
export async function pausePhaseHandler(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply
): Promise<unknown> {
  return reply.send({ ok: pauseRun(req.params.phaseId) });
}

/** POST /projects/:id/phases/:phaseId/resume — resume a paused phase run. */
export async function resumePhaseHandler(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply
): Promise<unknown> {
  return reply.send({ ok: resumeRun(req.params.phaseId) });
}

/** GET /projects/:id/phases/:phaseId/run-state — current control state. */
export async function runStateHandler(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply
): Promise<unknown> {
  return reply.send({ state: runState(req.params.phaseId) ?? null });
}
