/**
 * Tests: EPIC 4.2c — prompt-builder + bootstrap + snapshot (unit, mocked client).
 * The real daemon create→files round-trip was smoke-tested manually.
 */

import { describe, expect, it, vi } from 'vitest';

import { bootstrapDesignSession, buildStudioUrl, sanitizeOdProjectId } from '../bootstrap';
import type { OpenDesignClient } from '../client';
import { buildDesignBriefPrompt } from '../prompt-builder';
import { captureDesignArtifact, findHtmlArtifact } from '../snapshot';

function mockClient(overrides: Partial<OpenDesignClient> = {}): OpenDesignClient {
  return {
    health: vi.fn(async () => ({ ok: true, version: '0.6.0' })),
    createProject: vi.fn(async () => ({
      project: {
        id: 'wolfkrow-acme',
        name: 'Acme',
        skillId: null,
        designSystemId: null,
        metadata: { kind: 'prototype', fidelity: 'high-fidelity', source: 'wolfkrow' },
        createdAt: 1,
        updatedAt: 1,
      },
      conversationId: 'conv-1',
    })),
    listProjects: vi.fn(async () => []),
    getProject: vi.fn(async () => ({ id: 'wolfkrow-acme' })),
    getProjectFiles: vi.fn(async () => []),
    getProjectFile: vi.fn(async () => '<html></html>'),
    ...overrides,
  } as unknown as OpenDesignClient;
}

describe('buildDesignBriefPrompt', () => {
  it('includes the project name + spec + design system', () => {
    const p = buildDesignBriefPrompt({ projectName: 'Acme', specContent: 'Build a CRM.' });
    expect(p).toContain('Acme');
    expect(p).toContain('Build a CRM.');
    expect(p).toContain('design-contract');
  });

  it('falls back when the spec is empty', () => {
    const p = buildDesignBriefPrompt({ projectName: 'X', specContent: '   ' });
    expect(p).toContain('no spec provided');
  });
});

describe('bootstrap helpers + flow', () => {
  it('sanitizeOdProjectId lowercases + hyphenates', () => {
    expect(sanitizeOdProjectId('Proj ABC_123')).toBe('wolfkrow-proj-abc-123');
    expect(sanitizeOdProjectId('!!!')).toBe('wolfkrow-project');
  });

  it('buildStudioUrl appends project + embed params', () => {
    expect(buildStudioUrl('http://127.0.0.1:7460/', 'wolfkrow-acme')).toBe(
      'http://127.0.0.1:7460/projects/wolfkrow-acme?host=wolfkrow&locale=pt-BR'
    );
    expect(buildStudioUrl('http://127.0.0.1:7460', 'p1')).toBe(
      'http://127.0.0.1:7460/projects/p1?host=wolfkrow&locale=pt-BR'
    );
  });

  it('creates the OD project with the design-brief pending prompt + wolfkrow metadata', async () => {
    const client = mockClient();
    const r = await bootstrapDesignSession(client, {
      wolfkrowProjectId: 'wp-1',
      name: 'Acme',
      specContent: 'Build a CRM.',
      webUrl: 'http://127.0.0.1:7460',
    });
    expect(r.openDesignProjectId).toBe('wolfkrow-acme');
    expect(r.conversationId).toBe('conv-1');
    expect(r.studioUrl).toContain('host=wolfkrow');
    expect(r.prompt).toContain('Acme');
    expect(client.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'wolfkrow-wp-1',
        pendingPrompt: expect.stringContaining('CRM'),
        metadata: expect.objectContaining({ source: 'wolfkrow', wolfkrowProjectId: 'wp-1' }),
      })
    );
  });
});

describe('snapshot', () => {
  it('findHtmlArtifact prefers known candidates then any .html', () => {
    expect(findHtmlArtifact([{ path: 'other.txt' }, { path: 'index.html' }])).toBe('index.html');
    expect(findHtmlArtifact([{ path: 'a.html' }])).toBe('a.html');
    expect(findHtmlArtifact([{ path: 'x.txt' }])).toBeNull();
  });

  it('reads the HTML artifact when present', async () => {
    const client = mockClient({ getProjectFiles: vi.fn(async () => [{ path: 'index.html' }]) });
    const snap = await captureDesignArtifact(client, 'wolfkrow-acme');
    expect(snap.artifactPath).toBe('index.html');
    expect(snap.html).toBe('<html></html>');
    expect(client.getProjectFile).toHaveBeenCalledWith('wolfkrow-acme', 'index.html');
  });

  it('returns null when no HTML artifact exists yet', async () => {
    const client = mockClient({ getProjectFiles: vi.fn(async () => [{ path: 'readme.md' }]) });
    const snap = await captureDesignArtifact(client, 'wolfkrow-acme');
    expect(snap.html).toBeNull();
    expect(snap.artifactPath).toBeNull();
    expect(client.getProjectFile).not.toHaveBeenCalled();
  });
});
