import { describe, expect, it, vi } from 'vitest';

import type { AICompletionResult, AIProvider } from '../../ai-providers/types';
import {
  SecurityAuditRunner,
  parseFindingsFromText,
  runSecurityAgent,
  SECURITY_AUDIT_AGENTS,
} from '../security-audit-runner';

function makeProvider(responses: string[]): AIProvider {
  let i = 0;
  return {
    complete: vi.fn().mockImplementation(async (): Promise<AICompletionResult> => {
      const content = responses[i++] ?? '[]';
      return { content, usage: { inputTokens: 10, outputTokens: 5 } };
    }),
  };
}

describe('parseFindingsFromText', () => {
  it('parses a JSON array of findings', () => {
    const text = '[{"severity":"critical","file":"a.ts","line":10,"message":"x","rule":"y"}]';
    const out = parseFindingsFromText(text);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('critical');
    expect(out[0]!.file).toBe('a.ts');
    expect(out[0]!.line).toBe(10);
  });

  it('returns [] for malformed JSON', () => {
    expect(parseFindingsFromText('not json')).toEqual([]);
  });

  it('returns [] when no array found', () => {
    expect(parseFindingsFromText('plain text only')).toEqual([]);
  });

  it('skips invalid severity values', () => {
    const text = '[{"severity":"UNKNOWN","file":"a.ts","message":"x"}]';
    expect(parseFindingsFromText(text)).toEqual([]);
  });

  it('skips entries without file or message', () => {
    const text = '[{"severity":"info","message":"x"},{"severity":"info","file":"a.ts"}]';
    expect(parseFindingsFromText(text)).toEqual([]);
  });

  it('parses text wrapped in non-JSON prose', () => {
    const text = 'Here are the findings:\n[{"severity":"warning","file":"a.ts","message":"x"}]\nDone.';
    const out = parseFindingsFromText(text);
    expect(out).toHaveLength(1);
  });
});

describe('runSecurityAgent', () => {
  it('returns parsed findings from provider response', async () => {
    const provider = makeProvider(['[{"severity":"critical","file":"a.ts","message":"hardcoded key"}]']);
    const agent = SECURITY_AUDIT_AGENTS[0]!;
    const out = await runSecurityAgent({ agent, files: ['a.ts'], model: 'm', provider });
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('critical');
  });
});

describe('SecurityAuditRunner', () => {
  it('produces findings for a run with multiple agents', async () => {
    const provider = makeProvider([
      '[{"severity":"critical","file":"a.ts","message":"secret"}]',
      '[{"severity":"warning","file":"b.ts","message":"missing auth"}]',
      '[]',
    ]);
    const runner = new SecurityAuditRunner();
    const result = await runner.run({
      scanId: 'scan-1',
      projectPath: '/tmp/p',
      filesByRole: {
        config: ['a.ts'],
        auth: ['b.ts'],
      },
      model: 'm',
      provider,
    });
    expect(result.findings.length).toBe(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.bySeverity.critical).toBe(1);
    expect(result.summary.bySeverity.warning).toBe(1);
  });

  it('respects maxAgents cap', async () => {
    const provider = makeProvider(['[]', '[]', '[]']);
    const runner = new SecurityAuditRunner();
    const result = await runner.run({
      scanId: 'scan-2',
      projectPath: '/tmp/p',
      filesByRole: {},
      model: 'm',
      provider,
      maxAgents: 1,
    });
    expect(result.findings).toEqual([]);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('continues when one agent fails', async () => {
    let i = 0;
    const provider: AIProvider = {
      complete: vi.fn().mockImplementation(async () => {
        i++;
        if (i === 1) throw new Error('boom');
        return { content: '[]', usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    };
    const runner = new SecurityAuditRunner();
    const result = await runner.run({
      scanId: 'scan-3',
      projectPath: '/tmp/p',
      filesByRole: { config: ['a.ts'] },
      model: 'm',
      provider,
    });
    // First agent failed (secrets-scanner) — others should still run
    expect(result.findings).toEqual([]);
  });

  it('deduplicates files across multiple tags', async () => {
    const provider = makeProvider(['[]']);
    const runner = new SecurityAuditRunner();
    await runner.run({
      scanId: 'scan-4',
      projectPath: '/tmp/p',
      filesByRole: { config: ['a.ts', 'b.ts'], migration: ['b.ts', 'c.ts'] },
      model: 'm',
      provider,
      maxAgents: 1,
    });
    // Verify the agent was called with deduplicated files
    const call = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const userPrompt = (call[0] as { messages: Array<{ content: string }> }).messages[0]!.content;
    expect(userPrompt).toContain('a.ts');
    expect(userPrompt).toContain('b.ts');
    expect(userPrompt).toContain('c.ts');
    const aCount = (userPrompt.match(/- a\.ts/g) ?? []).length;
    expect(aCount).toBe(1);
  });
});
