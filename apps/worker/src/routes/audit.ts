import { summarizeFindings, type SecurityFinding, type SecurityScanSummary } from '@wolfkrow/domain';
import { BUILT_IN_PROVIDERS, getProviderById } from '@wolfkrow/domain';
import { SecurityAuditRunner, type AIProvider } from '@wolfkrow/infra';
import type { DrizzleSecurityFindingRepo, DrizzleSecurityScanRepo } from '@wolfkrow/infra';

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

function defaultFilesByRole(): Record<string, string[]> {
  return {};
}

async function resolveProvider(providerId: string | undefined): Promise<AIProvider> {
  const { aiFactory } = getAdapters();
  const { getProviderApiKey } = await import('../lib/keychain');
  const id = providerId ?? 'anthropic';
  const cfg = getProviderById(BUILT_IN_PROVIDERS, id) ?? getProviderById(BUILT_IN_PROVIDERS, 'anthropic');
  if (!cfg) throw new Error('No provider config available');
  const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount)) ?? (await getProviderApiKey(id));
  return aiFactory.createFromConfig(cfg, apiKey);
}

async function runAuditHandler(
  request: AuditRequest,
  reply: AuditReply,
): Promise<unknown> {
  const userId = request.user?.userId ?? 'anonymous';
  const { projectPath, model = 'claude-haiku-4-5-20251001', filesByRole, provider } = request.body ?? {};
  if (!projectPath || typeof projectPath !== 'string') {
    return reply.status(400).send({ error: 'projectPath is required' });
  }

  const { scanRepo, findingRepo } = getAuditRepos();
  const scan = scanRepo.create({ userId, projectPath });
  scanRepo.update(scan.id, { status: 'running' });
  try {
    const aiProvider = await resolveProvider(provider);
    const runner = new SecurityAuditRunner();
    const result = await runner.run({
      scanId: scan.id,
      projectPath,
      filesByRole: filesByRole ?? defaultFilesByRole(),
      model,
      provider: aiProvider,
    });
    findingRepo.insertMany(result.findings);
    const summary: SecurityScanSummary = result.summary;
    scanRepo.update(scan.id, {
      status: 'completed',
      completedAt: new Date(),
      summary: { ...summary },
    });
    return reply.send({
      scanId: scan.id,
      status: 'completed',
      findingCount: result.findings.length,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    scanRepo.update(scan.id, { status: 'failed', completedAt: new Date(), error: message });
    return reply.status(500).send({ error: message, scanId: scan.id });
  }
}

function getAuditRepos(): { scanRepo: DrizzleSecurityScanRepo; findingRepo: DrizzleSecurityFindingRepo } {
  const repos = getRepos();
  return {
    scanRepo: repos.securityScan as DrizzleSecurityScanRepo,
    findingRepo: repos.securityFinding as DrizzleSecurityFindingRepo,
  };
}

async function getScanHandler(
  request: AuditRequest,
  reply: AuditReply,
): Promise<unknown> {
  const { scanRepo } = getAuditRepos();
  const scan = scanRepo.findById(request.params.scanId);
  if (!scan) return reply.status(404).send({ error: 'Scan not found' });
  return reply.send(scan);
}

async function getFindingsHandler(
  request: AuditRequest,
  reply: AuditReply,
): Promise<unknown> {
  const { scanRepo, findingRepo } = getAuditRepos();
  const scan = scanRepo.findById(request.params.scanId);
  if (!scan) return reply.status(404).send({ error: 'Scan not found' });
  const findings = findingRepo.findByScan(request.params.scanId);
  return reply.send({
    scanId: scan.id,
    findings: findings.map((f: SecurityFinding) => f.toJSON()),
    summary: summarizeFindings(findings),
  });
}

interface ListQuery { userId?: string }

async function listScansHandler(request: { user?: { userId?: string }; query: ListQuery }): Promise<unknown> {
  const { scanRepo } = getAuditRepos();
  const userId = request.user?.userId ?? request.query.userId ?? 'anonymous';
  return scanRepo.listByUser(userId);
}

export async function auditRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };
  server.post<{ Body: RunAuditBody }>('/audit/run', auth, runAuditHandler as never);
  server.get<{ Params: { scanId: string } }>('/audit/scans/:scanId', auth, getScanHandler as never);
  server.get<{ Params: { scanId: string } }>('/audit/scans/:scanId/findings', auth, getFindingsHandler as never);
  server.get<{ Querystring: ListQuery }>('/audit/scans', auth, listScansHandler as never);
}
