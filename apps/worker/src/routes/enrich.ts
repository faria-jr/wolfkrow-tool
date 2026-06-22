/**
 * Enrich routes — Validator→Enricher spec pipeline.
 * B.3: AI-driven spec validation and enrichment.
 */

import { readFile } from 'node:fs/promises';

import { DrizzleEnrichSessionRepo, aiProviderFactory } from '@wolfkrow/infra';
import {
  CancelEnrichSessionUseCase,
  CreateEnrichSessionUseCase,
  GetEnrichSessionUseCase,
  ListEnrichSessionsUseCase,
  RunEnricherUseCase,
  RunValidatorUseCase,
} from '@wolfkrow/use-cases';
import type { ValidatorAgent, EnricherAgent } from '@wolfkrow/use-cases';
import keytar from 'keytar';

import type { AuthFastifyInstance } from '../types/fastify';


async function getApiKey(): Promise<string> {
  const key = await keytar.getPassword('wolfkrow', 'anthropic-api-key');
  if (!key) throw new Error('Missing anthropic-api-key in system keychain');
  return key;
}

function createValidator(): ValidatorAgent {
  return {
    async validate({ specContent }) {
      const apiKey = await getApiKey();
      const provider = aiProviderFactory.create('anthropic', apiKey);
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
      const apiKey = await getApiKey();
      const provider = aiProviderFactory.create('anthropic', apiKey);
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

interface CreateBody { userId: string; specPath: string; validatorAgentId?: string; enricherAgentId?: string; }
interface RunBody { specContent?: string; }
interface EnricherRunBody { specContent?: string; validatorOutput: string; }

export async function enrichRoutes(server: AuthFastifyInstance) {
  const makeRepo = () => new DrizzleEnrichSessionRepo();

  server.post<{ Body: CreateBody }>('/sessions', async (req) => {
    const { session } = await new CreateEnrichSessionUseCase(makeRepo()).execute(req.body);
    return session.toProps();
  });

  server.get<{ Querystring: { userId: string } }>('/sessions', async (req) => {
    const { sessions } = await new ListEnrichSessionsUseCase(makeRepo()).execute({ userId: req.query.userId });
    return sessions.map((s) => s.toProps());
  });

  server.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    try {
      const { session } = await new GetEnrichSessionUseCase(makeRepo()).execute({ sessionId: req.params.id });
      return session.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.post<{ Params: { id: string }; Body: RunBody }>('/sessions/:id/validate', async (req, reply) => {
    const session = await makeRepo().findById(req.params.id);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    const specContent = await loadSpec(req.body.specContent, session.specPath);
    const { session: updated, output } = await new RunValidatorUseCase(makeRepo(), createValidator()).execute({
      sessionId: session.id, specContent,
    });
    return { session: updated.toProps(), output };
  });

  server.post<{ Params: { id: string }; Body: EnricherRunBody }>('/sessions/:id/enrich', async (req, reply) => {
    const session = await makeRepo().findById(req.params.id);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    const specContent = await loadSpec(req.body.specContent, session.specPath);
    const { session: updated, output } = await new RunEnricherUseCase(makeRepo(), createEnricher()).execute({
      sessionId: session.id, specContent, validatorOutput: req.body.validatorOutput,
    });
    return { session: updated.toProps(), output };
  });

  server.delete<{ Params: { id: string }; Querystring: { userId: string } }>('/sessions/:id', async (req, reply) => {
    try {
      await new CancelEnrichSessionUseCase(makeRepo()).execute({ sessionId: req.params.id, userId: req.query.userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });
}
