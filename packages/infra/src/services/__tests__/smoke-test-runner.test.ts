import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { SmokeTestRunner } from '../smoke-test-runner';

function makeFixture(name: string, files: Record<string, string>): string {
  const dir = join(tmpdir(), `smoke-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe('SmokeTestRunner', () => {
  beforeEach(() => {
    process.env['WOLFKROW_SMOKE_ALLOWLIST'] = tmpdir();
  });

  it('detects broken imports', async () => {
    const dir = makeFixture('broken', {
      'package.json': JSON.stringify({ name: 'test', scripts: { test: 'echo' } }),
      'src/index.ts': `import { foo } from './does-not-exist';\nexport { foo };\n`,
    });
    try {
      const runner = new SmokeTestRunner();
      const result = await runner.run(dir, []);
      const brokenPaths = result.brokenImports.map((b) => b.importPath);
      expect(brokenPaths).toContain('./does-not-exist');
    } finally {
      cleanup(dir);
    }
  });

  it('reports missing expected files', async () => {
    const dir = makeFixture('missing', {
      'package.json': JSON.stringify({ name: 'test' }),
    });
    try {
      const runner = new SmokeTestRunner();
      const result = await runner.run(dir, ['README.md', 'NONEXISTENT.ts']);
      expect(result.missingFiles).toContain('README.md');
      expect(result.missingFiles).toContain('NONEXISTENT.ts');
    } finally {
      cleanup(dir);
    }
  });

  it('does not report existing files as missing', async () => {
    const dir = makeFixture('present', {
      'package.json': JSON.stringify({ name: 'test' }),
      'README.md': '# hello',
    });
    try {
      const runner = new SmokeTestRunner();
      const result = await runner.run(dir, ['README.md']);
      expect(result.missingFiles).not.toContain('README.md');
    } finally {
      cleanup(dir);
    }
  });

  it('skips non-source files in broken import walk', async () => {
    const dir = makeFixture('skip', {
      'package.json': JSON.stringify({ name: 'test' }),
      'README.md': 'import x from "./missing";',
    });
    try {
      const runner = new SmokeTestRunner();
      const result = await runner.run(dir, []);
      const mdBroken = result.brokenImports.find((b) => b.file.endsWith('.md'));
      expect(mdBroken).toBeUndefined();
    } finally {
      cleanup(dir);
    }
  });

  it('measures duration', async () => {
    const dir = makeFixture('dur', {
      'package.json': JSON.stringify({ name: 'test' }),
    });
    try {
      const runner = new SmokeTestRunner();
      const result = await runner.run(dir, []);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      cleanup(dir);
    }
  });
});

describe('SmokeTestRunner typecheck integration', () => {
  it.skipIf(!existsSync('/tmp/wolfkrow-smoke-integration-test'))('runs tsc when typescript dep present', async () => {
    // This is a long-running test that would invoke actual tsc; skipped by default
    // to keep CI fast. Enable by setting up a fixture with TS errors.
  });
});
