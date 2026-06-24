import { describe, expect, it } from 'vitest';
import { RepoProfile } from '../entities/repo-profile';

describe('RepoProfile', () => {
  it('creates with required fields', () => {
    const p = RepoProfile.create({
      root: '/home/user/myapp',
      languages: ['typescript'],
      frameworks: ['nextjs'],
      roles: { api: ['src/routes/chat.ts'], ui: ['src/pages/index.tsx'] },
      fileCount: 42,
    });
    expect(p.root).toBe('/home/user/myapp');
    expect(p.languages).toContain('typescript');
    expect(p.frameworks).toContain('nextjs');
    expect(p.fileCount).toBe(42);
    expect(p.roles['api']).toContain('src/routes/chat.ts');
  });

  it('toSummary returns compact string for LLM context', () => {
    const p = RepoProfile.create({
      root: '/repo',
      languages: ['typescript', 'python'],
      frameworks: ['fastapi', 'react'],
      roles: { backend: ['api/main.py'], frontend: ['src/App.tsx'] },
      fileCount: 100,
    });
    const summary = p.toSummary();
    expect(summary).toContain('typescript');
    expect(summary).toContain('fastapi');
    expect(summary).toContain('100');
  });

  it('toSummary returns empty-repo placeholder when no languages', () => {
    const p = RepoProfile.create({ root: '/empty', languages: [], frameworks: [], roles: {}, fileCount: 0 });
    const summary = p.toSummary();
    expect(summary.length).toBeGreaterThan(0);
  });

  it('roleFiles returns files for a given role', () => {
    const p = RepoProfile.create({
      root: '/repo',
      languages: ['typescript'],
      frameworks: [],
      roles: { api: ['routes/chat.ts', 'routes/auth.ts'] },
      fileCount: 2,
    });
    expect(p.roleFiles('api')).toEqual(['routes/chat.ts', 'routes/auth.ts']);
    expect(p.roleFiles('nonexistent')).toEqual([]);
  });
});
