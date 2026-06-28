import { BUILT_IN_PROVIDERS } from '@wolfkrow/domain';
import {
  DeleteProviderUseCase,
  ListProvidersUseCase,
  SaveProviderUseCase,
} from '@wolfkrow/use-cases';
import { z } from 'zod';

import { getAdapters, getRepos } from '../container';
import { fromQuery, paginateArray } from '../lib/paginate';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

const providerBody = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  protocol: z.enum(['anthropic-compat', 'openai-compatible']),
  baseUrl: z.string().url(),
  apiKeyAccount: z.string().min(1),
  models: z.array(z.string()).min(1),
  supportsTools: z.boolean(),
  pricingUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
});

type ProviderBody = z.infer<typeof providerBody>;

function userId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'anonymous';
}

async function listProviders(req: { user?: { userId?: string } }) {
  const repo = getRepos().providerConfig;
  const customConfigs = await repo.findAll(userId(req));
  const customIds = new Set(customConfigs.map((c) => c.id));
  const builtInIds = new Set(BUILT_IN_PROVIDERS.map((p) => p.id));
  const { providers } = await new ListProvidersUseCase(repo).execute({ userId: userId(req) });
  const secrets = getAdapters().secrets;
  return Promise.all(
    providers.map(async (p) => {
      const config = p.toJSON();
      const key = await secrets.get(config.apiKeyAccount);
      const hasDbRecord = customIds.has(config.id);
      const isBuiltInId = builtInIds.has(config.id);
      return {
        ...config,
        hasApiKey: Boolean(key),
        isOverridden: hasDbRecord && isBuiltInId,
        isCustom: hasDbRecord && !isBuiltInId,
      };
    })
  );
}

async function saveProvider(
  req: { user?: { userId?: string }; body: unknown },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } }
) {
  const body = validate(providerBody, req.body);
  const repo = getRepos().providerConfig;
  const { apiKey, pricingUrl, ...base } = body;
  const config = { ...base, ...(pricingUrl !== undefined ? { pricingUrl } : {}) };
  await new SaveProviderUseCase(repo).execute({ userId: userId(req), config });
  if (apiKey) await getAdapters().secrets.set(body.apiKeyAccount, apiKey);
  return reply.status(201).send({ ok: true });
}

export async function providerRoutes(server: AuthFastifyInstance) {
  server.get('/providers', { preHandler: [server.authenticate] }, async (req) => {
    const items = await listProviders(req);
    return paginateArray(fromQuery(req.query), items, 'providers');
  });

  server.post<{ Body: ProviderBody }>(
    '/providers',
    { preHandler: [server.authenticate] },
    async (req, reply) => {
      return saveProvider(req, reply);
    }
  );

  server.delete<{ Params: { id: string } }>(
    '/providers/:id',
    { preHandler: [server.authenticate] },
    async (req, reply) => {
      const repo = getRepos().providerConfig;
      const uc = new DeleteProviderUseCase(repo);
      await uc.execute({ userId: userId(req), id: req.params.id });
      return reply.status(204).send();
    }
  );
}
