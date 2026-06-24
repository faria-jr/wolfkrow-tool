import { existsSync, readFileSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve, sep } from 'node:path';

const MAX_FILE_SIZE = 1_048_576;
const TYPE_CHECK_TIMEOUT_MS = 120_000;
const LINT_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 180_000;
const MAX_WALK_FILES = 10_000;
const MAX_OUTPUT_BYTES = 4_000;

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

interface SpawnResult {
  exitCode: number;
  output: string;
}

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.wolfkrow',
  'out',
  '.next',
  '.cache',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const RESOLVE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '/index.ts',
  '/index.tsx',
  '/index.js',
];

const IMPORT_RE = /(?:^|\n)\s*import\s+[^'"]*['"](\.\.?\/[^'"]+)['"]/g;
const EXPORT_RE = /(?:^|\n)\s*(?:export\s+\*\s+from|export\s+\{[^}]*\}\s+from)\s*['"](\.\.?\/[^'"]+)['"]/g;

export class SmokeTestRunner {
  async run(projectPath: string, expectedFiles: string[] = []): Promise<SmokeTestResult> {
    const startMs = Date.now();
    const [typecheck, lint, tests] = await Promise.all([
      this.runTypecheck(projectPath),
      this.runLint(projectPath),
      this.runTests(projectPath),
    ]);
    const brokenImports = this.checkBrokenImports(projectPath);
    const missingFiles = this.checkMissingFiles(projectPath, expectedFiles);
    return {
      typecheck,
      lint,
      tests,
      brokenImports,
      missingFiles,
      durationMs: Date.now() - startMs,
    };
  }

  private spawnCommand(
    cmd: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<SpawnResult> {
    return new Promise((resolveP) => {
      let output = '';
      let timedOut = false;
      const child = spawn(cmd, args, {
        cwd,
        shell: true,
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

  private readPackageJson(projectPath: string): Record<string, unknown> | null {
    try {
      const pkgPath = join(projectPath, 'package.json');
      if (!existsSync(pkgPath)) return null;
      return JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return `${str.slice(0, maxLen)}\n...(truncated)`;
  }

  private async runTypecheck(projectPath: string): Promise<SmokeTestTypecheck> {
    try {
      const tsconfigExists = existsSync(join(projectPath, 'tsconfig.json'));
      const pkg = this.readPackageJson(projectPath);
      const deps = {
        ...((pkg?.['dependencies'] as Record<string, unknown> | undefined) ?? {}),
        ...((pkg?.['devDependencies'] as Record<string, unknown> | undefined) ?? {}),
      };
      const hasTypescript = 'typescript' in deps;
      if (!tsconfigExists || !hasTypescript) {
        return { ok: true, errors: 0, output: 'not applicable (no tsconfig.json or typescript dep)' };
      }
      const { exitCode, output } = await this.spawnCommand(
        'npx',
        ['tsc', '--noEmit'],
        projectPath,
        TYPE_CHECK_TIMEOUT_MS,
      );
      const matches = output.match(/error TS\d+:/g);
      return {
        ok: exitCode === 0,
        errors: matches ? matches.length : 0,
        output: this.truncate(output, MAX_OUTPUT_BYTES),
      };
    } catch {
      return { ok: true, errors: 0, output: '' };
    }
  }

  private async runLint(projectPath: string): Promise<SmokeTestLint> {
    try {
      const pkg = this.readPackageJson(projectPath);
      const scripts = (pkg?.['scripts'] as Record<string, unknown> | undefined) ?? {};
      if (!scripts['lint']) {
        return { available: false, ok: true, warnings: 0, errors: 0, output: '' };
      }
      const { exitCode, output } = await this.spawnCommand(
        'npm',
        ['run', 'lint'],
        projectPath,
        LINT_TIMEOUT_MS,
      );
      const truncated = this.truncate(output, MAX_OUTPUT_BYTES);
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

  private async runTests(projectPath: string): Promise<SmokeTestTests> {
    try {
      const pkg = this.readPackageJson(projectPath);
      const scripts = (pkg?.['scripts'] as Record<string, unknown> | undefined) ?? {};
      if (!scripts['test']) {
        return { available: false, passed: 0, failed: 0, output: '' };
      }
      const first = await this.spawnCommand(
        'npm',
        ['test', '--', '--run'],
        projectPath,
        TEST_TIMEOUT_MS,
      );
      let finalOutput = first.output;
      if (first.exitCode !== 0 && /unknown\s+option|unrecognized/i.test(first.output)) {
        const second = await this.spawnCommand('npm', ['test'], projectPath, TEST_TIMEOUT_MS);
        finalOutput = second.output;
      }
      const truncated = this.truncate(finalOutput, 6000);
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

  private resolveImport(fromDir: string, importPath: string): boolean {
    for (const ext of RESOLVE_EXTENSIONS) {
      const candidate = resolve(fromDir, importPath + ext);
      if (existsSync(candidate)) return true;
    }
    return false;
  }

  private collectSourceFiles(dir: string, results: string[], count: { value: number }): void {
    if (count.value >= MAX_WALK_FILES) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count.value >= MAX_WALK_FILES) return;
      const name = String(entry.name);
      if (SKIP_DIRS.has(name)) continue;
      const fullPath = join(dir, name);
      if (entry.isDirectory()) {
        this.collectSourceFiles(fullPath, results, count);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(name))) {
        try {
          if (statSync(fullPath).size <= MAX_FILE_SIZE) results.push(fullPath);
        } catch {
          // skip
        }
        count.value += 1;
      }
    }
  }

  private checkBrokenImports(projectPath: string): BrokenImport[] {
    const broken: BrokenImport[] = [];
    try {
      const files: string[] = [];
      const count = { value: 0 };
      this.collectSourceFiles(projectPath, files, count);

      for (const filePath of files) {
        let content: string;
        try {
          content = readFileSync(filePath, 'utf-8');
        } catch {
          continue;
        }
        const fromDir = dirname(filePath);
        const relFile = filePath.startsWith(projectPath + sep)
          ? filePath.slice(projectPath.length + 1)
          : filePath;
        const allMatches: string[] = [];
        let m: RegExpExecArray | null;
        IMPORT_RE.lastIndex = 0;
        while ((m = IMPORT_RE.exec(content)) !== null) {
          if (m[1]) allMatches.push(m[1]);
        }
        EXPORT_RE.lastIndex = 0;
        while ((m = EXPORT_RE.exec(content)) !== null) {
          if (m[1]) allMatches.push(m[1]);
        }
        for (const imp of allMatches) {
          if (!this.resolveImport(fromDir, imp)) {
            broken.push({ file: relFile, importPath: imp });
          }
        }
      }
    } catch {
      // walk failed; return what we have
    }
    return broken;
  }

  private checkMissingFiles(projectPath: string, expectedFiles: string[]): string[] {
    const missing: string[] = [];
    for (const p of expectedFiles) {
      try {
        if (!existsSync(resolve(projectPath, p))) missing.push(p);
      } catch {
        missing.push(p);
      }
    }
    return missing;
  }
}
