/**
 * Enrich routes — Validator→Enricher spec pipeline.
 * B.3: AI-driven spec validation and enrichment.
 */

import { readFile } from 'node:fs/promises';

import {
  CancelEnrichSessionUseCase,
  CreateEnrichSessionUseCase,
  GetEnrichSessionUseCase,
  ListEnrichSessionsUseCase,
  RunEnricherUseCase,
  RunValidatorUseCase,
} from '@wolfkrow/use-cases';
import type { ValidatorAgent, EnricherAgent } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getAdapters, getRepos } from '../container';
import { getAnthropicApiKey } from '../lib/keychain';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';


function createValidator(): ValidatorAgent {
  return {
    async validate({ specContent }) {
      const apiKey = await getAnthropicApiKey();
      const provider = getAdapters().aiFactory.create('anthropic', apiKey);
      const result = await provider.complete({
        model: 'claude-sonnet-4-6',
        system: 'You are a spec validator. Analyze this specification and identify: (1) missing sections, (2) ambiguous requirements, (3) technical inconsistencies. Return a structured validation report.',
        messages: [{ role: 'user', content: `Validate this spec:\n\n${specContent}` }],
        maxTokens: 2048,
        temperature: 0.2,
      });
      return { output: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
    },
  };
}

function createEnricher(): EnricherAgent {
  return {
    async enrich({ specContent, validatorOutput }) {
      const apiKey = await getAnthropicApiKey();
      const provider = getAdapters().aiFactory.create('anthropic', apiKey);
      const result = await provider.complete({
        model: 'claude-sonnet-4-6',
        system: 'You are a spec enricher. Using the validator\'s feedback, improve and complete the specification. Fill gaps, clarify ambiguities, and add missing details.',
        messages: [{ role: 'user', content: `Original spec:\n\n${specContent}\n\nValidator feedback:\n${validatorOutput}\n\nProvide the enriched specification.` }],
        maxTokens: 8192,
        temperature: 0.3,
      });
      return { output: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
    },
  };
}

async function loadSpec(specContent: string | undefined, specPath: string | null | undefined): Promise<string> {
  if (specContent) return specContent;
  if (!specPath) return '';
  try { return await readFile(specPath, 'utf8'); } catch { return ''; }
}

const createEnrichBody = z.object({
  userId: z.string().min(1).max(128),
  specPath: z.string().min(1).max(4096),
  validatorAgentId: z.string().max(128).optional(),
  enricherAgentId: z.string().max(128).optional(),
});
const runValidatorBody = z.object({ specContent: z.string().max(500_000).optional() });
const runEnricherBody = z.object({
  specContent: z.string().max(500_000).optional(),
  validatorOutput: z.string().min(1).max(200_000),
});

export async function enrichRoutes(server: AuthFastifyInstance) {
  const makeRepo = () => getRepos().enrichSession;

  // Enrich sessions are user-scoped. Require an authenticated session on every
  // route so anonymous callers cannot create/list/cancel another user's spec
  // sessions (the default-user leak class of P0-7/P2-1).
  const auth = { onRequest: [server.authenticate] };

  server.post('/sessions', auth, async (req) => {
    const body = validate(createEnrichBody, req.body);
    const { session } = await new CreateEnrichSessionUseCase(makeRepo()).execute({
      userId: body.userId,
      specPath: body.specPath,
      ...(body.validatorAgentId !== undefined ? { validatorAgentId: body.validatorAgentId } : {}),
      ...(body.enricherAgentId !== undefined ? { enricherAgentId: body.enricherAgentId } : {}),
    });
    return session.toProps();
  });

  server.get<{ Querystring: { userId: string } }>('/sessions', auth, async (req) => {
    const { sessions } = await new ListEnrichSessionsUseCase(makeRepo()).execute({ userId: req.query.userId });
    return sessions.map((s) => s.toProps());
  });

  server.get<{ Params: { id: string } }>('/sessions/:id', auth, async (req, reply) => {
    try {
      const { session } = await new GetEnrichSessionUseCase(makeRepo()).execute({ sessionId: req.params.id });
      return session.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.post<{ Params: { id: string } }>(
    '/sessions/:id/validate',
    auth,
    (req, reply) => runValidatorRoute(req, reply, makeRepo()),
  );

  server.post<{ Params: { id: string } }>(
    '/sessions/:id/enrich',
    auth,
    (req, reply) => runEnricherRoute(req, reply, makeRepo()),
  );

  server.delete<{ Params: { id: string }; Querystring: { userId: string } }>('/sessions/:id', auth, async (req, reply) => {
    try {
      await new CancelEnrichSessionUseCase(makeRepo()).execute({ sessionId: req.params.id, userId: req.query.userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });
}

/** POST /sessions/:id/validate — run the validator agent on the session's spec. */
async function runValidatorRoute(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  repo: ReturnType<typeof getRepos>['enrichSession'],
): Promise<unknown> {
  const body = validate(runValidatorBody, req.body ?? {});
  const session = await repo.findById(req.params.id);
  if (!session) return reply.status(404).send({ error: 'Not found' });
  const specContent = await loadSpec(body.specContent, session.specPath);
  const { session: updated, output } = await new RunValidatorUseCase(repo, createValidator()).execute({
    sessionId: session.id, specContent,
  });
  return { session: updated.toProps(), output };
}

/** POST /sessions/:id/enrich — run the enricher agent using validator output. */
async function runEnricherRoute(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  repo: ReturnType<typeof getRepos>['enrichSession'],
): Promise<unknown> {
  const body = validate(runEnricherBody, req.body);
  const session = await repo.findById(req.params.id);
  if (!session) return reply.status(404).send({ error: 'Not found' });
  const specContent = await loadSpec(body.specContent, session.specPath);
  const { session: updated, output } = await new RunEnricherUseCase(repo, createEnricher()).execute({
    sessionId: session.id, specContent, validatorOutput: body.validatorOutput,
  });
  return { session: updated.toProps(), output };
}
