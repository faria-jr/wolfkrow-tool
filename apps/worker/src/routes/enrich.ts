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

import { getRepos } from '../container';
import { resolveAIProvider } from '../lib/provider-resolver';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

const DEFAULT_ENRICH_MODEL = 'claude-sonnet-4-6';

function createValidator(userId: string, agentId: string | undefined): ValidatorAgent {
  return {
    async validate({ specContent }) {
      const agent = agentId ? await getRepos().agent.findById(agentId) : undefined;
      const { provider } = await resolveAIProvider({
        model: agent?.model ?? DEFAULT_ENRICH_MODEL,
        userId,
        ...(agent?.provider ? { providerId: agent.provider } : {}),
      });
      const result = await provider.complete({
        model: agent?.model ?? DEFAULT_ENRICH_MODEL,
        system:
          'You are a spec validator. Analyze this specification and identify: (1) missing sections, (2) ambiguous requirements, (3) technical inconsistencies. Return a structured validation report.',
        messages: [{ role: 'user', content: `Validate this spec:\n\n${specContent}` }],
        maxTokens: 2048,
        temperature: 0.2,
      });
      return {
        output: result.content,
        tokens: result.usage.inputTokens + result.usage.outputTokens,
      };
    },
  };
}

function createEnricher(userId: string, agentId: string | undefined): EnricherAgent {
  return {
    async enrich({ specContent, validatorOutput }) {
      const agent = agentId ? await getRepos().agent.findById(agentId) : undefined;
      const { provider } = await resolveAIProvider({
        model: agent?.model ?? DEFAULT_ENRICH_MODEL,
        userId,
        ...(agent?.provider ? { providerId: agent.provider } : {}),
      });
      const result = await provider.complete({
        model: agent?.model ?? DEFAULT_ENRICH_MODEL,
        system:
          "You are a spec enricher. Using the validator's feedback, improve and complete the specification. Fill gaps, clarify ambiguities, and add missing details.",
        messages: [
          {
            role: 'user',
            content: `Original spec:\n\n${specContent}\n\nValidator feedback:\n${validatorOutput}\n\nProvide the enriched specification.`,
          },
        ],
        maxTokens: 8192,
        temperature: 0.3,
      });
      return {
        output: result.content,
        tokens: result.usage.inputTokens + result.usage.outputTokens,
      };
    },
  };
}

async function loadSpec(
  specContent: string | undefined,
  specPath: string | null | undefined
): Promise<string> {
  if (specContent) return specContent;
  if (!specPath) return '';
  try {
    return await readFile(specPath, 'utf8');
  } catch {
    return '';
  }
}

const createEnrichBody = z.object({
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
  // sessions (the default-user leak class of P0-7/P2-1). The user identity is
  // ALWAYS derived from the authenticated session (req.user.userId) — never from
  // the request body/query — so an authenticated user cannot spoof another
  // user's identity (IDOR).
  const auth = { onRequest: [server.authenticate] };
  const uid = (req: FastifyRequest) => (req as unknown as { user: { userId: string } }).user.userId;

  server.post('/sessions', auth, async (req) => {
    const body = validate(createEnrichBody, req.body);
    const { session } = await new CreateEnrichSessionUseCase(makeRepo()).execute(uid(req), {
      specPath: body.specPath,
      ...(body.validatorAgentId !== undefined ? { validatorAgentId: body.validatorAgentId } : {}),
      ...(body.enricherAgentId !== undefined ? { enricherAgentId: body.enricherAgentId } : {}),
    });
    return session.toProps();
  });

  server.get('/sessions', auth, async (req) => {
    const { sessions } = await new ListEnrichSessionsUseCase(makeRepo()).execute({
      userId: uid(req),
    });
    return sessions.map((s) => s.toProps());
  });

  server.get<{ Params: { id: string } }>('/sessions/:id', auth, async (req, reply) => {
    try {
      const { session } = await new GetEnrichSessionUseCase(makeRepo()).execute({
        sessionId: req.params.id,
      });
      return session.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.post<{ Params: { id: string } }>('/sessions/:id/validate', auth, (req, reply) =>
    runValidatorRoute(req, reply, makeRepo(), uid(req))
  );

  server.post<{ Params: { id: string } }>('/sessions/:id/enrich', auth, (req, reply) =>
    runEnricherRoute(req, reply, makeRepo(), uid(req))
  );

  server.delete<{ Params: { id: string } }>('/sessions/:id', auth, async (req, reply) => {
    try {
      await new CancelEnrichSessionUseCase(makeRepo()).execute({
        sessionId: req.params.id,
        userId: uid(req),
      });
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
  userId: string
): Promise<unknown> {
  const body = validate(runValidatorBody, req.body ?? {});
  const session = await repo.findById(req.params.id);
  if (!session) return reply.status(404).send({ error: 'Not found' });
  const specContent = await loadSpec(body.specContent, session.specPath);
  const { session: updated, output } = await new RunValidatorUseCase(
    repo,
    createValidator(userId, session.validatorAgentId)
  ).execute({
    sessionId: session.id,
    specContent,
  });
  return { session: updated.toProps(), output };
}

/** POST /sessions/:id/enrich — run the enricher agent using validator output. */
async function runEnricherRoute(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  repo: ReturnType<typeof getRepos>['enrichSession'],
  userId: string
): Promise<unknown> {
  const body = validate(runEnricherBody, req.body);
  const session = await repo.findById(req.params.id);
  if (!session) return reply.status(404).send({ error: 'Not found' });
  const specContent = await loadSpec(body.specContent, session.specPath);
  const { session: updated, output } = await new RunEnricherUseCase(
    repo,
    createEnricher(userId, session.enricherAgentId)
  ).execute({
    sessionId: session.id,
    specContent,
    validatorOutput: body.validatorOutput,
  });
  return { session: updated.toProps(), output };
}
