/**
 * Vault routes — secrets metadata API. Values never leave the server.
 */

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';

import { SecretCategorySchema, StoreSecretInputSchema } from '@wolfkrow/shared-types';
import {
  DeleteSecretUseCase,
  GetSecretValueUseCase,
  ListSecretsUseCase,
  StoreSecretUseCase,
} from '@wolfkrow/use-cases';
import { z } from 'zod';

import { getAdapters, getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

const EXPORT_VERSION = 1;
const KDF_ITERS = 100_000;
const KDF_KEYLEN = 32;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, KDF_ITERS, KDF_KEYLEN, 'sha256');
}

interface ExportPayload {
  version: number;
  salt: string;
  iv: string;
  data: string;
}

interface ExportedSecret {
  key: string;
  value: string;
  displayName: string;
  category: string;
}

function encryptVault(secrets: ExportedSecret[], passphrase: string): ExportPayload {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify({ secrets });
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version: EXPORT_VERSION,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    data: Buffer.concat([enc, tag]).toString('hex'),
  };
}

function decryptVault(payload: ExportPayload, passphrase: string): ExportedSecret[] {
  const salt = Buffer.from(payload.salt, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const raw = Buffer.from(payload.data, 'hex');
  const enc = raw.subarray(0, -16);
  const tag = raw.subarray(-16);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const json = decipher.update(enc) + decipher.final('utf8');
  return (JSON.parse(json) as { secrets: ExportedSecret[] }).secrets;
}

/**
 * Store-secret body. Built from the shared `StoreSecretInputSchema` (ADR-0005
 * single source of truth) with `metadata` omitted — the worker sets metadata
 * server-side, never from the request body.
 */
const storeBody = StoreSecretInputSchema.omit({ metadata: true });

function mask(value: string): string {
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(8)}${value.slice(-4)}`;
}

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function vaultRoutes(server: AuthFastifyInstance) {
  const repo = getRepos().secret;
  const adapter = getAdapters().secrets;

  const listUC = new ListSecretsUseCase(repo);
  const storeUC = new StoreSecretUseCase(repo, adapter);
  const getValueUC = new GetSecretValueUseCase(repo, adapter);
  const deleteUC = new DeleteSecretUseCase(repo, adapter);

  type SecretBody = z.infer<typeof storeBody>;

  // Secrets are inherently user-scoped: getUserId resolves the owner from
  // req.user. Without authentication every request maps to the shared
  // 'default' user, so every browser user would read/write the SAME vault
  // (the default-user leak class). Authenticate every route in this plugin.
  const auth = { onRequest: [server.authenticate] };

  server.get('/', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { secrets } = await listUC.execute({ userId });
    return reply.send({ secrets: secrets.map((s) => s.toProps()) });
  });

  server.post<{ Body: SecretBody }>('/', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { key, value, displayName, category, description } = validate(storeBody, req.body);
    const { secret } = await storeUC.execute({
      userId, key, value, displayName, category,
      ...(description !== undefined ? { description } : {}),
    });
    return reply.status(201).send({ secret: secret.toProps() });
  });

  server.get<{ Params: { key: string } }>('/:key/masked', auth, async (req, reply) => {
    const { value } = await getValueUC.execute({ key: req.params.key });
    if (value === null) return reply.status(404).send({ error: 'Secret not found' });
    return reply.send({ masked: mask(value) });
  });

  server.delete<{ Params: { key: string } }>('/:key', auth, async (req, reply) => {
    await deleteUC.execute({ key: req.params.key });
    return reply.send({ ok: true });
  });

  registerBackupRoutes(server, listUC, storeUC, getValueUC);
}

/**
 * Backup export/import bodies (worker-specific; no shared contract).
 */
const exportBody = z.object({ passphrase: z.string().min(1) });
const importBody = z.object({
  passphrase: z.string().min(1),
  payload: z.object({
    version: z.number().int(),
    salt: z.string().min(1),
    iv: z.string().min(1),
    data: z.string().min(1),
  }),
});

function registerBackupRoutes(
  server: AuthFastifyInstance,
  listUC: ListSecretsUseCase,
  storeUC: StoreSecretUseCase,
  getValueUC: GetSecretValueUseCase,
) {
  const auth = { onRequest: [server.authenticate] };
  server.post('/export', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { passphrase } = validate(exportBody, req.body);
    const { secrets } = await listUC.execute({ userId });
    const exported: ExportedSecret[] = [];
    for (const s of secrets) {
      const { value } = await getValueUC.execute({ key: s.key });
      if (value !== null) exported.push({ key: s.key, value, displayName: s.displayName, category: s.category });
    }
    return reply.send({ payload: encryptVault(exported, passphrase) });
  });

  server.post('/import', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const { passphrase, payload } = validate(importBody, req.body);
    let secrets: ExportedSecret[];
    try { secrets = decryptVault(payload, passphrase); }
    catch { return reply.status(400).send({ error: 'Invalid passphrase or corrupted backup' }); }
    let imported = 0;
    for (const s of secrets) {
      const parsed = SecretCategorySchema.safeParse(s.category);
      await storeUC.execute({ userId, key: s.key, value: s.value, displayName: s.displayName, category: parsed.success ? parsed.data : 'other' });
      imported++;
    }
    return reply.send({ imported });
  });
}
