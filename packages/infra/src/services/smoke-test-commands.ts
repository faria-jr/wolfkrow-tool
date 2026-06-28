import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SmokeTestLint, SmokeTestTests, SmokeTestTypecheck } from './smoke-test-runner';

const TYPE_CHECK_TIMEOUT_MS = 120_000;
const LINT_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 180_000;
const MAX_OUTPUT_BYTES = 4_000;

interface SpawnResult {
  exitCode: number;
  output: string;
}

export function readPackageJson(projectPath: string): Record<string, unknown> | null {
  try {
    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) return null;
    return JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}\n...(truncated)`;
}

function spawnCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<SpawnResult> {
  return new Promise((resolveP) => {
    let output = '';
    let timedOut = false;
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      env: { ...process.env },
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveP({ exitCode: timedOut ? -1 : (code ?? -1), output });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolveP({ exitCode: -1, output });
    });
  });
}

export async function runTypecheck(projectPath: string): Promise<SmokeTestTypecheck> {
  try {
    const tsconfigExists = existsSync(join(projectPath, 'tsconfig.json'));
    const pkg = readPackageJson(projectPath);
    const deps = {
      ...((pkg?.['dependencies'] as Record<string, unknown> | undefined) ?? {}),
      ...((pkg?.['devDependencies'] as Record<string, unknown> | undefined) ?? {}),
    };
    const hasTypescript = 'typescript' in deps;
    if (!tsconfigExists || !hasTypescript) {
      return { ok: true, errors: 0, output: 'not applicable (no tsconfig.json or typescript dep)' };
    }
    const { exitCode, output } = await spawnCommand(
      'npx',
      ['tsc', '--noEmit'],
      projectPath,
      TYPE_CHECK_TIMEOUT_MS
    );
    const matches = output.match(/error TS\d+:/g);
    return {
      ok: exitCode === 0,
      errors: matches ? matches.length : 0,
      output: truncate(output, MAX_OUTPUT_BYTES),
    };
  } catch {
    return { ok: true, errors: 0, output: '' };
  }
}

export async function runLint(projectPath: string): Promise<SmokeTestLint> {
  try {
    const pkg = readPackageJson(projectPath);
    const scripts = (pkg?.['scripts'] as Record<string, unknown> | undefined) ?? {};
    if (!scripts['lint']) {
      return { available: false, ok: true, warnings: 0, errors: 0, output: '' };
    }
    const { exitCode, output } = await spawnCommand(
      'npm',
      ['run', 'lint'],
      projectPath,
      LINT_TIMEOUT_MS
    );
    const truncated = truncate(output, MAX_OUTPUT_BYTES);
    const errMatch = truncated.match(/(\d+)\s+(?:error|errors)/i);
    const warnMatch = truncated.match(/(\d+)\s+(?:warning|warnings)/i);
    return {
      available: true,
      ok: exitCode === 0,
      errors: errMatch ? parseInt(errMatch[1]!, 10) : 0,
      warnings: warnMatch ? parseInt(warnMatch[1]!, 10) : 0,
      output: truncated,
    };
  } catch {
    return { available: false, ok: true, warnings: 0, errors: 0, output: '' };
  }
}

export async function runTests(projectPath: string): Promise<SmokeTestTests> {
  try {
    const pkg = readPackageJson(projectPath);
    const scripts = (pkg?.['scripts'] as Record<string, unknown> | undefined) ?? {};
    if (!scripts['test']) {
      return { available: false, passed: 0, failed: 0, output: '' };
    }
    const first = await spawnCommand('npm', ['test', '--', '--run'], projectPath, TEST_TIMEOUT_MS);
    let finalOutput = first.output;
    if (first.exitCode !== 0 && /unknown\s+option|unrecognized/i.test(first.output)) {
      const second = await spawnCommand('npm', ['test'], projectPath, TEST_TIMEOUT_MS);
      finalOutput = second.output;
    }
    const truncated = truncate(finalOutput, 6000);
    const passedMatch = truncated.match(/(\d+)\s+passed/);
    const failedMatch = truncated.match(/(\d+)\s+failed/);
    return {
      available: true,
      passed: passedMatch ? parseInt(passedMatch[1]!, 10) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]!, 10) : 0,
      output: truncated,
    };
  } catch {
    return { available: false, passed: 0, failed: 0, output: '' };
  }
}
