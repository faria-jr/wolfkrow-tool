/**
 * Vault routes — secrets metadata API. Values never leave the server.
 */

import { DrizzleSecretRepo } from '@wolfkrow/infra/repos';
import { KeytarSecretsAdapter } from '@wolfkrow/infra/secrets/keytar-adapter';
import {
  ListSecretsUseCase,
  StoreSecretUseCase,
  GetSecretValueUseCase,
  DeleteSecretUseCase,
} from '@wolfkrow/use-cases';

import type { AuthFastifyInstance } from '../types/fastify';

function mask(value: string): string {
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(8)}${value.slice(-4)}`;
}

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function vaultRoutes(server: AuthFastifyInstance) {
  const repo = new DrizzleSecretRepo();
  const adapter = new KeytarSecretsAdapter();

  const listUC = new ListSecretsUseCase(repo);
  const storeUC = new StoreSecretUseCase(repo, adapter);
  const getValueUC = new GetSecretValueUseCase(repo, adapter);
  const deleteUC = new DeleteSecretUseCase(repo, adapter);

  type SecretBody = { key: string; value: string; displayName: string; category: 'ai' | 'integration' | 'oauth' | 'other'; description?: string; userId?: string };

  // GET /vault — list secrets metadata (no values)
  server.get('/', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { secrets } = await listUC.execute({ userId });
    return reply.send({ secrets: secrets.map((s) => s.toProps()) });
  });

  // POST /vault — store / rotate secret
  server.post<{ Body: SecretBody }>('/', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { key, value, displayName, category, description } = req.body;
    if (!key || !value || !displayName || !category) {
      return reply.status(400).send({ error: 'key, value, displayName, category required' });
    }

    const { secret } = await storeUC.execute({
      userId,
      key,
      value,
      displayName,
      category,
      ...(description !== undefined ? { description } : {}),
    });

    return reply.status(201).send({ secret: secret.toProps() });
  });

  // GET /vault/:key/masked — returns masked value for UI display
  server.get<{ Params: { key: string } }>('/:key/masked', async (req, reply) => {
    const { value } = await getValueUC.execute({ key: req.params.key });
    if (value === null) return reply.status(404).send({ error: 'Secret not found' });
    return reply.send({ masked: mask(value) });
  });

  // DELETE /vault/:key — delete from keytar + metadata
  server.delete<{ Params: { key: string } }>('/:key', async (req, reply) => {
    await deleteUC.execute({ key: req.params.key });
    return reply.send({ ok: true });
  });
}
