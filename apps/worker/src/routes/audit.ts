import { summarizeFindings, type SecurityFinding } from '@wolfkrow/domain';
import { BUILT_IN_PROVIDERS, getProviderById } from '@wolfkrow/domain';
import { ListFindingsUseCase, ListScansUseCase, RunAuditUseCase } from '@wolfkrow/use-cases';

import { getAdapters, getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';

interface RunAuditBody {
  projectPath: string;
  model?: string;
  filesByRole?: Record<string, string[]>;
  provider?: string;
}

interface AuditRequest { user?: { userId?: string }; params: { scanId: string }; body: RunAuditBody | null; }
interface AuditReply {
  status: (n: number) => { send: (b: unknown) => unknown };
  send: (b: unknown) => unknown;
}

async function resolveProvider(providerId: string | undefined): Promise<unknown> {
  const { aiFactory } = getAdapters();
  const { getProviderApiKey } = await import('../lib/keychain');
  const id = providerId ?? 'anthropic';
  const cfg = getProviderById(BUILT_IN_PROVIDERS, id) ?? getProviderById(BUILT_IN_PROVIDERS, 'anthropic');
  if (!cfg) throw new Error('No provider config available');
  const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount)) ?? (await getProviderApiKey(id));
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

async function runAuditHandler(
  request: AuditRequest,
  reply: AuditReply,
): Promise<unknown> {
  const userId = authUserId(request);
  const { projectPath, model, filesByRole, provider } = request.body ?? {};
  if (!projectPath || typeof projectPath !== 'string') {
    return reply.status(400).send({ error: 'projectPath is required' });
  }

  const { scanRepo, findingRepo } = getAuditRepos();
  const useCase = new RunAuditUseCase(scanRepo, findingRepo);
  const result = await useCase.execute({
    userId,
    projectPath,
    provider: await resolveProvider(provider),
    runner: getAdapters().securityAuditRunner,
    ...(model !== undefined ? { model } : {}),
    ...(filesByRole !== undefined ? { filesByRole } : {}),
  });

  if (result.status === 'failed') {
    return reply.status(500).send({ error: result.error, scanId: result.scanId });
  }
  return reply.send(result);
}

async function getScanHandler(
  request: AuditRequest,
  reply: AuditReply,
): Promise<unknown> {
  const userId = authUserId(request);
  const { scanRepo } = getAuditRepos();
  const scan = scanRepo.findById(request.params.scanId);
  if (!scan) return reply.status(404).send({ error: 'Scan not found' });
  if (scan.userId !== userId) return reply.status(404).send({ error: 'Scan not found' });
  return reply.send(scan);
}

async function getFindingsHandler(
  request: AuditRequest,
  reply: AuditReply,
): Promise<unknown> {
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

async function listScansHandler(request: { user?: { userId?: string } }): Promise<unknown> {
  const userId = authUserId(request);
  const { scanRepo } = getAuditRepos();
  const useCase = new ListScansUseCase(scanRepo);
  return useCase.execute({ userId });
}

export async function auditRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };
  server.post<{ Body: RunAuditBody }>('/audit/run', auth, runAuditHandler as never);
  server.get<{ Params: { scanId: string } }>('/audit/scans/:scanId', auth, getScanHandler as never);
  server.get<{ Params: { scanId: string } }>('/audit/scans/:scanId/findings', auth, getFindingsHandler as never);
  server.get('/audit/scans', auth, listScansHandler as never);
}
