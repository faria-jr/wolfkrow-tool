import { describe, expect, it } from 'vitest';

import { DailySummary } from '../entities/daily-summary';
import { EnrichSession } from '../entities/enrich-session';
import { GlobalRule } from '../entities/global-rule';
import { HarnessProject } from '../entities/harness-project';
import { HarnessRound } from '../entities/harness-round';
import { HarnessSprint } from '../entities/harness-sprint';
import { KnowledgeChunk } from '../entities/knowledge-chunk';
import { KnowledgeDocument } from '../entities/knowledge-document';
import { PipelinePhase } from '../entities/pipeline-phase';
import { PipelineProject } from '../entities/pipeline-project';
import { ScheduledTask } from '../entities/scheduled-task';
import { Secret } from '../entities/secret';
import { SemanticMemory } from '../entities/semantic-memory';
import { TaskRun } from '../entities/task-run';
import { WorkflowRun } from '../entities/workflow-run';
import { ValidationError } from '../errors/domain-error';

// ─── GlobalRule ───────────────────────────────────────────────────────────────

describe('GlobalRule', () => {
  const base = { userId: 'u1', kind: 'behavior' as const, title: 'Be concise', body: 'Use short replies.' };

  it('create sets defaults', () => {
    const r = GlobalRule.create(base);
    expect(r.id).toBeTruthy();
    expect(r.enabled).toBe(true);
    expect(r.sortOrder).toBe(0);
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it('roundtrip fromProps/toProps', () => {
    const props = { id: 'r1', ...base, enabled: true, sortOrder: 5, createdAt: new Date(), updatedAt: new Date() };
    expect(GlobalRule.fromProps(props).toProps()).toEqual(props);
  });

  it('toggle flips enabled', () => {
    const r = GlobalRule.create(base);
    expect(r.toggle().enabled).toBe(false);
    expect(r.toggle().toggle().enabled).toBe(true);
  });

  it('withUpdate patches fields', () => {
    const r = GlobalRule.create(base);
    const updated = r.withUpdate({ title: 'New title', sortOrder: 10 });
    expect(updated.title).toBe('New title');
    expect(updated.sortOrder).toBe(10);
    expect(updated.id).toBe(r.id);
  });

  it('toPromptSection formats correctly', () => {
    const r = GlobalRule.create(base);
    expect(r.toPromptSection()).toBe(`## ${base.title}\n${base.body}`);
  });
});

// ─── KnowledgeDocument ────────────────────────────────────────────────────────

describe('KnowledgeDocument', () => {
  const base = { userId: 'u1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1024 };

  it('create defaults to pending', () => {
    const doc = KnowledgeDocument.create(base);
    expect(doc.status).toBe('pending');
    expect(doc.chunkCount).toBe(0);
    expect(doc.embeddingModel).toBeUndefined();
    expect(doc.error).toBeUndefined();
  });

  it('throws on empty filename', () => {
    expect(() => KnowledgeDocument.create({ ...base, filename: '' })).toThrow(ValidationError);
    expect(() => KnowledgeDocument.create({ ...base, filename: '  ' })).toThrow(ValidationError);
  });

  it('throws on negative size', () => {
    expect(() => KnowledgeDocument.create({ ...base, size: -1 })).toThrow(ValidationError);
  });

  it('markProcessing → markReady lifecycle', () => {
    const doc = KnowledgeDocument.create(base).markProcessing().markReady(42);
    expect(doc.status).toBe('ready');
    expect(doc.chunkCount).toBe(42);
    expect(doc.embeddingModel).toBe('voyage-3');
    expect(doc.isReady()).toBe(true);
  });

  it('markFailed sets error', () => {
    const doc = KnowledgeDocument.create(base).markFailed('parse error');
    expect(doc.status).toBe('failed');
    expect(doc.error).toBe('parse error');
    expect(doc.isReady()).toBe(false);
  });

  it('roundtrip fromProps/toProps', () => {
    const doc = KnowledgeDocument.create(base);
    const props = doc.toProps();
    expect(KnowledgeDocument.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── KnowledgeChunk ───────────────────────────────────────────────────────────

describe('KnowledgeChunk', () => {
  const base = {
    documentId: 'd1',
    content: 'Hello world',
    embedding: undefined,
    metadata: { sourceType: 'paragraph' as const, position: 0 },
    position: 0,
  };

  it('create generates id and createdAt', () => {
    const chunk = KnowledgeChunk.create(base);
    expect(chunk.id).toBeTruthy();
    expect(chunk.createdAt).toBeInstanceOf(Date);
    expect(chunk.content).toBe('Hello world');
  });

  it('withEmbedding attaches vector', () => {
    const chunk = KnowledgeChunk.create(base).withEmbedding([0.1, 0.2, 0.3]);
    expect(chunk.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('roundtrip fromProps/toProps', () => {
    const chunk = KnowledgeChunk.create(base);
    const props = chunk.toProps();
    expect(KnowledgeChunk.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── ScheduledTask ────────────────────────────────────────────────────────────

describe('ScheduledTask', () => {
  const base = {
    userId: 'u1', name: 'Daily reminder', description: undefined,
    cronExpression: '0 9 * * *', timezone: 'America/Sao_Paulo',
    prompt: 'Send daily report', agentId: undefined,
    enabled: true, lastRunAt: undefined, nextRunAt: undefined,
    config: {}, tags: [],
  };

  it('create sets id and timestamps', () => {
    const t = ScheduledTask.create(base);
    expect(t.id).toBeTruthy();
    expect(t.createdAt).toBeInstanceOf(Date);
    expect(t.name).toBe('Daily reminder');
  });

  it('withUpdate patches fields', () => {
    const t = ScheduledTask.create(base);
    const updated = t.withUpdate({ name: 'Weekly review', enabled: false });
    expect(updated.name).toBe('Weekly review');
    expect(updated.enabled).toBe(false);
    expect(updated.id).toBe(t.id);
  });

  it('withNextRun updates schedule', () => {
    const t = ScheduledTask.create(base);
    const now = new Date();
    const next = new Date(now.getTime() + 86400000);
    const updated = t.withNextRun(next, now);
    expect(updated.nextRunAt).toEqual(next);
    expect(updated.lastRunAt).toEqual(now);
  });

  it('roundtrip fromProps/toProps', () => {
    const t = ScheduledTask.create(base);
    const props = t.toProps();
    expect(ScheduledTask.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── Secret ───────────────────────────────────────────────────────────────────

describe('Secret', () => {
  const base = { userId: 'u1', key: 'OPENAI_KEY', displayName: 'OpenAI API Key', category: 'ai' as const };

  it('create sets lastRotated and undefined lastAccessed', () => {
    const s = Secret.create(base);
    expect(s.id).toBeTruthy();
    expect(s.lastAccessed).toBeUndefined();
    expect(s.lastRotated).toBeInstanceOf(Date);
  });

  it('withAccessed updates lastAccessed', () => {
    const s = Secret.create(base).withAccessed();
    expect(s.lastAccessed).toBeInstanceOf(Date);
  });

  it('withRotated updates lastRotated', () => {
    const before = Secret.create(base).lastRotated;
    const s = Secret.create(base).withRotated();
    expect(s.lastRotated!.getTime()).toBeGreaterThanOrEqual(before!.getTime());
  });

  it('withUpdate patches display fields', () => {
    const s = Secret.create(base).withUpdate({ displayName: 'New name', category: 'integration' });
    expect(s.displayName).toBe('New name');
    expect(s.category).toBe('integration');
  });

  it('roundtrip fromProps/toProps', () => {
    const s = Secret.create(base);
    const props = s.toProps();
    expect(Secret.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── SemanticMemory ───────────────────────────────────────────────────────────

describe('SemanticMemory', () => {
  const base = {
    userId: 'u1', content: 'User prefers concise answers',
    embedding: undefined, source: 'conversation' as const,
    importance: 75, metadata: {},
  };

  it('create clamps importance 0-100', () => {
    const high = SemanticMemory.create({ ...base, importance: 200 });
    expect(high.importance).toBe(100);
    const low = SemanticMemory.create({ ...base, importance: -10 });
    expect(low.importance).toBe(0);
    const mid = SemanticMemory.create({ ...base, importance: 75 });
    expect(mid.importance).toBe(75);
  });

  it('create starts with accessCount=0', () => {
    const m = SemanticMemory.create(base);
    expect(m.accessCount).toBe(0);
    expect(m.lastAccessedAt).toBeUndefined();
  });

  it('withEmbedding attaches vector', () => {
    const m = SemanticMemory.create(base).withEmbedding([0.5, 0.6]);
    expect(m.embedding).toEqual([0.5, 0.6]);
  });

  it('accessed increments count and sets timestamp', () => {
    const now = new Date();
    const m = SemanticMemory.create(base).accessed(now);
    expect(m.accessCount).toBe(1);
    expect(m.lastAccessedAt).toEqual(now);
  });

  it('roundtrip fromProps/toProps', () => {
    const m = SemanticMemory.create(base);
    const props = m.toProps();
    expect(SemanticMemory.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── HarnessProject ───────────────────────────────────────────────────────────

describe('HarnessProject', () => {
  const base = {
    userId: 'u1', name: 'My Project', description: undefined,
    specPath: '/specs/project.md', config: { maxRoundsPerFeature: 3, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' },
  };

  it('create starts in planning with zero metrics', () => {
    const p = HarnessProject.create(base);
    expect(p.status).toBe('planning');
    expect(p.metrics.totalTokens).toBe(0);
    expect(p.completedAt).toBeUndefined();
  });

  it('withStatus transitions to running', () => {
    const p = HarnessProject.create(base).withStatus('running');
    expect(p.status).toBe('running');
  });

  it('withStatus with completedAt marks finished', () => {
    const now = new Date();
    const p = HarnessProject.create(base).withStatus('completed', now);
    expect(p.completedAt).toEqual(now);
  });

  it('withMetrics accumulates tokens', () => {
    const p = HarnessProject.create(base).withMetrics({ totalTokens: 500, totalCost: 0.01 });
    expect(p.metrics.totalTokens).toBe(500);
  });

  it('roundtrip fromProps/toProps', () => {
    const p = HarnessProject.create(base);
    const props = p.toProps();
    expect(HarnessProject.fromProps(props).toProps()).toEqual(props);
  });

  it('accepts optional providerId in config', () => {
    const p = HarnessProject.create({ ...base, config: { ...base.config, providerId: 'zai' } });
    expect(p.config.providerId).toBe('zai');
  });

  it('providerId defaults to undefined when omitted', () => {
    const p = HarnessProject.create(base);
    expect(p.config.providerId).toBeUndefined();
  });
});

// ─── HarnessRound ─────────────────────────────────────────────────────────────

describe('HarnessRound', () => {
  const base = { sprintId: 's1', featureIndex: 0, roundNumber: 1 };

  it('create starts as coder_running with zero metrics', () => {
    const r = HarnessRound.create(base);
    expect(r.status).toBe('coder_running');
    expect(r.metrics.coderTokens).toBe(0);
    expect(r.completedAt).toBeUndefined();
  });

  it('withCoderOutput → evaluator_running', () => {
    const r = HarnessRound.create(base).withCoderOutput('impl code', 1000);
    expect(r.status).toBe('evaluator_running');
    expect(r.coderOutput).toBe('impl code');
    expect(r.metrics.coderTokens).toBe(1000);
  });

  it('complete passes/fails', () => {
    const passed = HarnessRound.create(base).withCoderOutput('x', 0).complete('passed', 'LGTM', 200);
    expect(passed.status).toBe('passed');
    expect(passed.evaluatorFeedback).toBe('LGTM');
    expect(passed.metrics.evaluatorTokens).toBe(200);
    expect(passed.completedAt).toBeInstanceOf(Date);
  });

  it('roundtrip fromProps/toProps', () => {
    const r = HarnessRound.create(base);
    const props = r.toProps();
    expect(HarnessRound.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── HarnessSprint ────────────────────────────────────────────────────────────

describe('HarnessSprint', () => {
  const features = [
    { name: 'Login', description: 'User login', acceptanceCriteria: ['JWT token'] },
    { name: 'Logout', description: 'User logout', acceptanceCriteria: ['Session cleared'] },
  ];
  const base = { projectId: 'p1', number: 1, name: 'Sprint 1', description: undefined, features };

  it('create counts features correctly', () => {
    const s = HarnessSprint.create(base);
    expect(s.metrics.featuresTotal).toBe(2);
    expect(s.metrics.featuresPassed).toBe(0);
    expect(s.status).toBe('pending');
  });

  it('withStatus in_progress sets startedAt', () => {
    const now = new Date();
    const s = HarnessSprint.create(base).withStatus('in_progress', now);
    expect(s.status).toBe('in_progress');
    expect(s.startedAt).toEqual(now);
  });

  it('withStatus completed sets completedAt', () => {
    const now = new Date();
    const s = HarnessSprint.create(base).withStatus('completed', now);
    expect(s.completedAt).toEqual(now);
  });

  it('roundtrip fromProps/toProps', () => {
    const s = HarnessSprint.create(base);
    const props = s.toProps();
    expect(HarnessSprint.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── PipelineProject ──────────────────────────────────────────────────────────

describe('PipelineProject', () => {
  const base = { userId: 'u1', name: 'Pipeline 1', description: 'Test pipeline' };

  it('create starts at discovery/running', () => {
    const p = PipelineProject.create({ ...base, projectPath: '/tmp/repo' });
    expect(p.currentStage).toBe('discovery');
    expect(p.status).toBe('running');
    expect(p.projectPath).toBe('/tmp/repo');
    expect(p.metrics.totalTokens).toBe(0);
  });

  it('withStage advances pipeline', () => {
    const p = PipelineProject.create(base).withStage('spec_build', { discoveryNotes: 'notes' });
    expect(p.currentStage).toBe('spec_build');
    expect(p.discoveryNotes).toBe('notes');
  });

  it('withStatus transitions properly', () => {
    const now = new Date();
    const p = PipelineProject.create(base).withStatus('completed', now);
    expect(p.status).toBe('completed');
    expect(p.completedAt).toEqual(now);
  });

  it('withMetrics accumulates', () => {
    const p = PipelineProject.create(base).withMetrics({ totalTokens: 1000, totalCost: 0.05 });
    expect(p.metrics.totalTokens).toBe(1000);
    expect(p.metrics.totalCost).toBe(0.05);
  });

  it('roundtrip fromProps/toProps', () => {
    const p = PipelineProject.create(base);
    const props = p.toProps();
    expect(PipelineProject.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── PipelinePhase ────────────────────────────────────────────────────────────

describe('PipelinePhase', () => {
  const base = { projectId: 'p1', stage: 'discovery' as const };

  it('create defaults to pending', () => {
    const ph = PipelinePhase.create(base);
    expect(ph.status).toBe('pending');
    expect(ph.artifactPath).toBeUndefined();
    expect(ph.metrics.tokens).toBe(0);
  });

  it('start transitions to in_progress', () => {
    const now = new Date();
    const ph = PipelinePhase.create(base).start(now);
    expect(ph.status).toBe('in_progress');
    expect(ph.startedAt).toEqual(now);
  });

  it('complete sets artifact and metrics', () => {
    const started = new Date(Date.now() - 1000);
    const now = new Date();
    const ph = PipelinePhase.create(base).start(started).complete('/path/artifact.md', 300, now);
    expect(ph.status).toBe('completed');
    expect(ph.artifactPath).toBe('/path/artifact.md');
    expect(ph.metrics.tokens).toBe(300);
    expect(ph.metrics.durationMs).toBeGreaterThan(0);
  });

  it('awaitUser and fail transitions', () => {
    expect(PipelinePhase.create(base).awaitUser().status).toBe('awaiting_user');
    expect(PipelinePhase.create(base).fail().status).toBe('failed');
  });

  it('roundtrip fromProps/toProps', () => {
    const ph = PipelinePhase.create(base);
    const props = ph.toProps();
    expect(PipelinePhase.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── TaskRun ──────────────────────────────────────────────────────────────────

describe('TaskRun', () => {
  it('create starts pending with no timestamps', () => {
    const tr = TaskRun.create({ taskId: 't1' });
    expect(tr.status).toBe('pending');
    expect(tr.startedAt).toBeUndefined();
    expect(tr.completedAt).toBeUndefined();
  });

  it('start sets running state', () => {
    const now = new Date();
    const tr = TaskRun.create({ taskId: 't1' }).start(now);
    expect(tr.status).toBe('running');
    expect(tr.startedAt).toEqual(now);
  });

  it('complete with output', () => {
    const now = new Date();
    const tr = TaskRun.create({ taskId: 't1' })
      .start(now)
      .complete('awaiting_review', { output: { result: 'ok' }, metrics: { tokens: 500, cost: 0.01 }, now });
    expect(tr.status).toBe('awaiting_review');
    expect(tr.output).toEqual({ result: 'ok' });
    expect(tr.metrics?.tokens).toBe(500);
  });

  it('review validates or rejects', () => {
    const tr = TaskRun.create({ taskId: 't1' })
      .start()
      .complete('awaiting_review')
      .review('validated', 'Looks good');
    expect(tr.status).toBe('validated');
    expect(tr.reviewNote).toBe('Looks good');
    expect(tr.reviewedAt).toBeInstanceOf(Date);
  });

  it('roundtrip fromProps/toProps', () => {
    const tr = TaskRun.create({ taskId: 't1' });
    const props = tr.toProps();
    expect(TaskRun.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── WorkflowRun ──────────────────────────────────────────────────────────────

describe('WorkflowRun', () => {
  const base = { userId: 'u1', workflowName: 'data-pipeline', input: { source: 'db' } };

  it('create starts pending', () => {
    const wr = WorkflowRun.create(base);
    expect(wr.status).toBe('pending');
    expect(wr.startedAt).toBeUndefined();
    expect(wr.metrics.stepCount).toBe(0);
  });

  it('start transitions to running', () => {
    const now = new Date();
    const wr = WorkflowRun.create(base).start(now);
    expect(wr.status).toBe('running');
    expect(wr.startedAt).toEqual(now);
  });

  it('complete sets output and duration', () => {
    const started = new Date(Date.now() - 5000);
    const now = new Date();
    const wr = WorkflowRun.create(base).start(started).complete({ rows: 100 }, 3, now);
    expect(wr.status).toBe('completed');
    expect(wr.output).toEqual({ rows: 100 });
    expect(wr.metrics.stepCount).toBe(3);
    expect(wr.metrics.durationMs).toBeGreaterThan(0);
  });

  it('fail captures error', () => {
    const wr = WorkflowRun.create(base).start().fail('connection refused');
    expect(wr.status).toBe('failed');
    expect(wr.error).toBe('connection refused');
    expect(wr.completedAt).toBeInstanceOf(Date);
  });

  it('roundtrip fromProps/toProps', () => {
    const wr = WorkflowRun.create(base);
    const props = wr.toProps();
    expect(WorkflowRun.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── DailySummary ─────────────────────────────────────────────────────────────

describe('DailySummary', () => {
  const base = {
    userId: 'u1', date: '2024-01-15', content: 'Productive day',
    sessionCount: 3, messageCount: 42, tokensUsed: 15000, cost: 0.50, metadata: {},
  };

  it('create sets id and createdAt', () => {
    const s = DailySummary.create(base);
    expect(s.id).toBeTruthy();
    expect(s.createdAt).toBeInstanceOf(Date);
    expect(s.date).toBe('2024-01-15');
    expect(s.cost).toBe(0.50);
  });

  it('roundtrip fromProps/toProps', () => {
    const s = DailySummary.create(base);
    const props = s.toProps();
    expect(DailySummary.fromProps(props).toProps()).toEqual(props);
  });
});

// ─── EnrichSession ────────────────────────────────────────────────────────────

describe('EnrichSession', () => {
  const base = { userId: 'u1', specPath: '/specs/feat.md', validatorAgentId: 'va1', enricherAgentId: 'ea1' };

  it('create starts pending with zero metrics', () => {
    const s = EnrichSession.create(base);
    expect(s.status).toBe('pending');
    expect(s.validatorMetrics.tokens).toBe(0);
    expect(s.startedAt).toBeUndefined();
  });

  it('startValidator transitions to validator', () => {
    const now = new Date();
    const s = EnrichSession.create(base).startValidator(now);
    expect(s.status).toBe('validator');
    expect(s.startedAt).toEqual(now);
  });

  it('startEnricher after validator', () => {
    const s = EnrichSession.create(base).startValidator().startEnricher();
    expect(s.status).toBe('enricher');
  });

  it('completeValidator records metrics', () => {
    const s = EnrichSession.create(base).startValidator().completeValidator(800, 2000);
    expect(s.validatorMetrics.tokens).toBe(800);
    expect(s.validatorMetrics.durationMs).toBe(2000);
  });

  it('completeEnricher marks completed', () => {
    const now = new Date();
    const s = EnrichSession.create(base)
      .startValidator()
      .startEnricher()
      .completeEnricher(1200, 3000, now);
    expect(s.status).toBe('completed');
    expect(s.completedAt).toEqual(now);
    expect(s.enricherMetrics.tokens).toBe(1200);
  });

  it('cancel at any point', () => {
    const s = EnrichSession.create(base).cancel();
    expect(s.status).toBe('cancelled');
    expect(s.completedAt).toBeInstanceOf(Date);
  });

  it('roundtrip fromProps/toProps', () => {
    const s = EnrichSession.create(base);
    const props = s.toProps();
    expect(EnrichSession.fromProps(props).toProps()).toEqual(props);
  });
});
