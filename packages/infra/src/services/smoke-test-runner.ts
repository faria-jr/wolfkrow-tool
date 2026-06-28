import { resolve, sep } from 'node:path';

import { runLint, runTests, runTypecheck } from './smoke-test-commands';
import { checkBrokenImports, checkMissingFiles } from './smoke-test-imports';

export interface SmokeTestTypecheck {
  ok: boolean;
  errors: number;
  output: string;
}

export interface SmokeTestLint {
  available: boolean;
  ok: boolean;
  warnings: number;
  errors: number;
  output: string;
}

export interface SmokeTestTests {
  available: boolean;
  passed: number;
  failed: number;
  output: string;
}

export interface BrokenImport {
  file: string;
  importPath: string;
}

export interface SmokeTestResult {
  typecheck: SmokeTestTypecheck;
  lint: SmokeTestLint;
  tests: SmokeTestTests;
  brokenImports: BrokenImport[];
  missingFiles: string[];
  durationMs: number;
}

export function isInsideAllowedRoot(projectPath: string): boolean {
  const resolved = resolve(projectPath);
  if (!resolved.startsWith(sep)) return false;
  const allowlist = process.env['WOLFKROW_SMOKE_ALLOWLIST'];
  if (allowlist) {
    const roots = allowlist.split(',').map((r) => resolve(r.trim()));
    return roots.some((root) => resolved === root || resolved.startsWith(root + sep));
  }
  const cwd = resolve(process.cwd());
  return resolved === cwd || resolved.startsWith(cwd + sep);
}

export class SmokeTestRunner {
  async run(projectPath: string, expectedFiles: string[] = []): Promise<SmokeTestResult> {
    if (!isInsideAllowedRoot(projectPath)) {
      throw new Error(`Project path is outside the allowed workspace: ${projectPath}`);
    }
    const startMs = Date.now();
    const [typecheck, lint, tests] = await Promise.all([
      runTypecheck(projectPath),
      runLint(projectPath),
      runTests(projectPath),
    ]);
    return {
      typecheck,
      lint,
      tests,
      brokenImports: checkBrokenImports(projectPath),
      missingFiles: checkMissingFiles(projectPath, expectedFiles),
      durationMs: Date.now() - startMs,
    };
  }
}
