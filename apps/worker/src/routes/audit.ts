import { summarizeFindings, type SecurityFinding, type SecurityScanSummary } from '@wolfkrow/domain';
import { SecurityAuditRunner, DrizzleSecurityFindingRepo, DrizzleSecurityScanRepo, type AIProvider } from '@wolfkrow/infra';

import { getAdapters, getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';

interface RunAuditBody {
  projectPath: string;
  model?: string;
  filesByRole?: Record<string, string[]>;
  provider?: string;
}

function defaultFilesByRole(projectPath: string): Record<string, string[]> {
  // Without a full repo-profiler integration here, we use an empty manifest
  // by default. Callers (CLI/UI) can pass `filesByRole` explicitly.
  void projectPath;
  return {};
}

async function resolveProvider(providerId: string | undefined): Promise<AIProvider> {
  const { aiFactory } = getAdapters();
  const { BUILT_IN_PROVIDERS, getProviderById } = await import('@wolfkrow/domain');
  const { getProviderApiKey } = await import('../lib/keychain');
  const id = providerId ?? 'anthropic';
  const cfg = getProviderById(BUILT_IN_PROVIDERS, id) ?? getProviderById(BUILT_IN_PROVIDERS, 'anthropic');
  if (!cfg) throw new Error('No provider config available');
  const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount)) ?? (await getProviderApiKey(id));
  return aiFactory.createFromConfig(cfg, apiKey);
}

export async function auditRoutes(server: AuthFastifyInstance) {
  const repos = getRepos();
  const scanRepo = repos.securityScan as DrizzleSecurityScanRepo;
  const findingRepo = repos.securityFinding as DrizzleSecurityFindingRepo;

  server.post<{ Body: RunAuditBody }>(
    '/audit/run',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const userId = request.user?.userId ?? 'anonymous';
      const { projectPath, model = 'claude-haiku-4-5-20251001', filesByRole, provider } = request.body ?? {};
      if (!projectPath || typeof projectPath !== 'string') {
        return reply.status(400).send({ error: 'projectPath is required' });
      }

      const scan = scanRepo.create({ userId, projectPath });
      scanRepo.update(scan.id, { status: 'running' });
      try {
        const aiProvider = await resolveProvider(provider);
        const runner = new SecurityAuditRunner();
        const result = await runner.run({
          scanId: scan.id,
          projectPath,
          filesByRole: filesByRole ?? defaultFilesByRole(projectPath),
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
    },
  );

  server.get<{ Params: { scanId: string } }>(
    '/audit/scans/:scanId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const scan = scanRepo.findById(request.params.scanId);
      if (!scan) return reply.status(404).send({ error: 'Scan not found' });
      return reply.send(scan);
    },
  );

  server.get<{ Params: { scanId: string } }>(
    '/audit/scans/:scanId/findings',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const scan = scanRepo.findById(request.params.scanId);
      if (!scan) return reply.status(404).send({ error: 'Scan not found' });
      const findings = findingRepo.findByScan(request.params.scanId);
      return reply.send({
        scanId: scan.id,
        findings: findings.map((f: SecurityFinding) => f.toJSON()),
        summary: summarizeFindings(findings),
      });
    },
  );

  server.get<{ Querystring: { userId?: string } }>(
    '/audit/scans',
    { preHandler: [server.authenticate] },
    async (request) => {
      const userId = request.user?.userId ?? request.query.userId ?? 'anonymous';
      return scanRepo.listByUser(userId);
    },
  );
}

// Quiet unused-import warning while keeping type for IDEs.
void ({} as AIProvider);