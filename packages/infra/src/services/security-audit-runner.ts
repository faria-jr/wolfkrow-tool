import {
  SecurityFinding,
  summarizeFindings,
  type SecurityDimension,
  type SecuritySeverity,
} from '@wolfkrow/domain';

import type { AIProvider } from '../ai-providers/types';

import { runInBatches } from './batch-runner';
import { parseFindingsFromText } from './security-audit-parser';

export { parseFindingsFromText };

export interface SecurityAuditAgentDef {
  id: string;
  name: string;
  dimension: SecurityDimension;
  tags: string[];
  systemPrompt: string;
  promptTemplate: (files: string[], fileList: string) => string;
}

export const SECURITY_AUDIT_AGENTS: readonly SecurityAuditAgentDef[] = [
  {
    id: 'secrets-scanner',
    name: 'Secrets Scanner',
    dimension: 'secrets',
    tags: ['config', 'migration'],
    systemPrompt:
      'You are a security auditor scanning for hardcoded secrets, API keys, tokens, and credentials. Output one finding per issue using the JSON schema.',
    promptTemplate: (_files, list) =>
      `Scan the following files for hardcoded secrets, API keys, tokens, and credentials.\n\n${list}\n\nRespond with a JSON array of findings. Each finding: {"severity":"critical|warning|major|info","file":"relative/path","line":42,"message":"...","rule":"hardcoded-secret"}. Empty array if clean.`,
  },
  {
    id: 'auth-auditor',
    name: 'Auth Auditor',
    dimension: 'auth',
    tags: ['auth', 'route', 'middleware'],
    systemPrompt:
      'You are a security auditor specializing in authentication and authorization. Look for missing auth checks, broken access controls, and IDOR.',
    promptTemplate: (_files, list) =>
      `Review these files for authentication and authorization flaws (missing checks, IDOR, broken access control).\n\n${list}\n\nRespond with JSON array: {"severity":"critical|warning|major|info","file":"...","line":N,"message":"...","rule":"auth-bypass"}.`,
  },
  {
    id: 'owasp-scanner',
    name: 'OWASP Scanner',
    dimension: 'owasp',
    tags: ['route', 'query', 'template'],
    systemPrompt:
      'You are a security auditor applying the OWASP Top 10. Look for injection, XSS, SSRF, insecure deserialization.',
    promptTemplate: (_files, list) =>
      `Apply the OWASP Top 10 to these files. Focus on injection, XSS, SSRF, insecure deserialization.\n\n${list}\n\nRespond with JSON array of findings: {"severity":"critical|warning|major|info","file":"...","line":N,"message":"...","rule":"owasp-top10"}.`,
  },
] as const;

export interface ParsedFinding {
  severity: SecuritySeverity;
  file: string;
  line?: number;
  message: string;
  rule?: string;
}

export interface RunAgentOptions {
  agent: SecurityAuditAgentDef;
  files: string[];
  model: string;
  provider: AIProvider;
}

export async function runSecurityAgent(opts: RunAgentOptions): Promise<ParsedFinding[]> {
  const fileList =
    opts.files.length > 0 ? opts.files.map((f) => `- ${f}`).join('\n') : '(no files matched tags)';
  const userPrompt = opts.agent.promptTemplate(opts.files, fileList);
  const result = await opts.provider.complete({
    model: opts.model,
    system: opts.agent.systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 4096,
    temperature: 0.1,
  });
  return parseFindingsFromText(result.content);
}

export interface SecurityAuditOptions {
  scanId: string;
  projectPath: string;
  filesByRole: Record<string, string[]>;
  model: string;
  provider: AIProvider;
  maxAgents?: number;
}

export interface SecurityAuditResult {
  scanId: string;
  findings: SecurityFinding[];
  summary: ReturnType<typeof summarizeFindings>;
}

function toSecurityFinding(
  parsed: ParsedFinding,
  agent: SecurityAuditAgentDef,
  scanId: string
): SecurityFinding {
  return SecurityFinding.create({
    scanId,
    severity: parsed.severity,
    dimension: agent.dimension,
    file: parsed.file,
    ...(parsed.line !== undefined ? { line: parsed.line } : {}),
    message: parsed.message,
    ...(parsed.rule !== undefined ? { rule: parsed.rule } : {}),
    agentId: agent.id,
  });
}

export class SecurityAuditRunner {
  private readonly maxConcurrency: number;

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  async run(opts: SecurityAuditOptions): Promise<SecurityAuditResult> {
    const maxAgents = opts.maxAgents ?? SECURITY_AUDIT_AGENTS.length;
    const slice = SECURITY_AUDIT_AGENTS.slice(0, maxAgents);

    const agentResults = await runInBatches(
      slice,
      (agent) => this.runAgent(agent, opts),
      this.maxConcurrency
    );
    const findings = agentResults.flat();

    return {
      scanId: opts.scanId,
      findings,
      summary: summarizeFindings(findings),
    };
  }

  private async runAgent(
    agent: SecurityAuditAgentDef,
    opts: SecurityAuditOptions
  ): Promise<SecurityFinding[]> {
    const files = this.resolveFilesForAgent(opts.filesByRole, agent.tags);
    try {
      const parsed = await runSecurityAgent({
        agent,
        files,
        model: opts.model,
        provider: opts.provider,
      });
      return parsed.map((p) => toSecurityFinding(p, agent, opts.scanId));
    } catch {
      return [];
    }
  }

  private resolveFilesForAgent(filesByRole: Record<string, string[]>, tags: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of tags) {
      const files = filesByRole[tag] ?? [];
      for (const f of files) {
        if (seen.has(f)) continue;
        seen.add(f);
        out.push(f);
      }
    }
    return out;
  }
}
