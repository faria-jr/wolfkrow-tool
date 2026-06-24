import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepoProfilerService } from '../repo-profiler';

function makeFixture(name: string): string {
  const dir = join(tmpdir(), `profiler-test-${name}-${Date.now()}`);
  mkdirSync(join(dir, 'src', 'routes'), { recursive: true });
  mkdirSync(join(dir, 'src', 'components'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-app', dependencies: { next: '*', fastify: '*' } }));
  writeFileSync(join(dir, 'src', 'routes', 'chat.ts'), `export function chatHandler() {}`);
  writeFileSync(join(dir, 'src', 'components', 'Button.tsx'), `export function Button() { return null; }`);
  writeFileSync(join(dir, 'src', 'index.ts'), `console.log('hello')`);
  return dir;
}

describe('RepoProfilerService', () => {
  it('detects typescript language from .ts files', async () => {
    const dir = makeFixture('lang');
    try {
      const svc = new RepoProfilerService();
      const profile = await svc.profile(dir);
      expect(profile.languages).toContain('typescript');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects frameworks from package.json', async () => {
    const dir = makeFixture('fw');
    try {
      const svc = new RepoProfilerService();
      const profile = await svc.profile(dir);
      expect(profile.frameworks.some((f) => f === 'nextjs' || f === 'fastify')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('assigns api role to files in routes/', async () => {
    const dir = makeFixture('roles');
    try {
      const svc = new RepoProfilerService();
      const profile = await svc.profile(dir);
      const apiFiles = profile.roleFiles('api');
      expect(apiFiles.some((f) => f.includes('routes'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('counts files excluding node_modules and .git', async () => {
    const dir = makeFixture('count');
    try {
      mkdirSync(join(dir, 'node_modules', 'lodash'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'lodash', 'index.js'), '');
      mkdirSync(join(dir, '.git'), { recursive: true });
      writeFileSync(join(dir, '.git', 'config'), '');
      const svc = new RepoProfilerService();
      const profile = await svc.profile(dir);
      // Should NOT count node_modules or .git files
      expect(profile.fileCount).toBe(4); // package.json + 3 ts/tsx files
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
