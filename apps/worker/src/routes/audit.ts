import { summarizeFindings, type SecurityFinding } from '@wolfkrow/domain';
import { getProviderById } from '@wolfkrow/domain';
import { ListFindingsUseCase, ListScansUseCase, RunAuditUseCase } from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getAdapters, getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

const runAuditBody = z.object({
  projectPath: z.string().min(1).max(4096),
  model: z.string().max(128).optional(),
  filesByRole: z.record(z.string(), z.array(z.string())).optional(),
  provider: z.string().max(128).optional(),
});

type ScanRequest = FastifyRequest<{ Params: { scanId: string } }>;

async function resolveProvider(providerId: string | undefined, userId?: string): Promise<unknown> {
  const { aiFactory } = getAdapters();
  const { listAllProviders } = await import('../agent-factory');
  const { getProviderApiKey } = await import('../lib/keychain');
  const all = await listAllProviders(userId);
  const id = providerId ?? 'anthropic';
  const cfg = getProviderById(all, id) ?? getProviderById(all, 'anthropic');
  if (!cfg) throw new Error('No provider config available');
  const apiKey =
    (await getAdapters().secrets.get(cfg.apiKeyAccount)) ?? (await getProviderApiKey(id));
  return aiFactory.createFromConfig(cfg, apiKey);
}

function getAuditRepos() {
  const repos = getRepos();
  return {
    scanRepo: repos.securityScan,
    findingRepo: repos.securityFinding,
  };
}

function authUserId(request: { user?: { userId?: string } }): string {
  const userId = request.user?.userId;
  if (!userId) throw new Error('authenticated user required');
  return userId;
}

async function runAuditHandler(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const userId = authUserId(request);
  const { projectPath, model, filesByRole, provider } = validate(runAuditBody, request.body);

  const { scanRepo, findingRepo } = getAuditRepos();
  const useCase = new RunAuditUseCase(scanRepo, findingRepo);
  const result = await useCase.execute({
    userId,
    projectPath,
    provider: await resolveProvider(provider, userId),
    runner: getAdapters().securityAuditRunner,
    ...(model !== undefined ? { model } : {}),
    ...(filesByRole !== undefined ? { filesByRole } : {}),
  });

  if (result.status === 'failed') {
    return reply.status(500).send({ error: result.error, scanId: result.scanId });
  }
  return reply.send(result);
}

async function getScanHandler(request: ScanRequest, reply: FastifyReply): Promise<unknown> {
  const userId = authUserId(request);
  const { scanRepo } = getAuditRepos();
  const scan = scanRepo.findById(request.params.scanId);
  if (!scan) return reply.status(404).send({ error: 'Scan not found' });
  if (scan.userId !== userId) return reply.status(404).send({ error: 'Scan not found' });
  return reply.send(scan);
}

async function getFindingsHandler(request: ScanRequest, reply: FastifyReply): Promise<unknown> {
  const userId = authUserId(request);
  const { scanRepo, findingRepo } = getAuditRepos();
  const scan = scanRepo.findById(request.params.scanId);
  if (!scan || scan.userId !== userId) return reply.status(404).send({ error: 'Scan not found' });
  const useCase = new ListFindingsUseCase(scanRepo, findingRepo);
  const { findings } = await useCase.execute({ scanId: request.params.scanId, userId });
  return reply.send({
    scanId: scan.id,
    findings: findings.map((f: SecurityFinding) => f.toJSON()),
    summary: summarizeFindings(findings),
  });
}

async function listScansHandler(request: FastifyRequest): Promise<unknown> {
  const userId = authUserId(request);
  const { scanRepo } = getAuditRepos();
  const useCase = new ListScansUseCase(scanRepo);
  return useCase.execute({ userId });
}

export async function auditRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };
  server.post('/audit/run', auth, runAuditHandler);
  server.get<{ Params: { scanId: string } }>('/audit/scans/:scanId', auth, getScanHandler);
  server.get<{ Params: { scanId: string } }>(
    '/audit/scans/:scanId/findings',
    auth,
    getFindingsHandler
  );
  server.get('/audit/scans', auth, listScansHandler);
}
