import { spawn } from 'node:child_process';
import * as path from 'node:path';

import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

const FORBIDDEN_PATTERNS = [/\bsudo\b/, /\bsu\s+/, /\bchmod\s+[0-9]*7/];
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_COMMAND_LENGTH = 4096;

const ALLOWED_BINARIES = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'echo',
  'pwd',
  'env',
  'grep',
  'find',
  'sort',
  'uniq',
  'tr',
  'cut',
  'sed',
  'awk',
  'node',
  'npm',
  'pnpm',
  'npx',
  'yarn',
  'git',
  'mkdir',
  'rmdir',
  'touch',
  'cp',
  'mv',
  'ln',
  'tar',
  'gzip',
  'gunzip',
  'zip',
  'unzip',
  'curl',
  'wget',
  'jq',
  // Shells (bash/sh/dash/zsh) intentionally excluded: allowing them lets an
  // agent run `bash -c '<arbitrary>'`, bypassing FORBIDDEN_PATTERNS (which are
  // only matched against the top-level tokens). spawn() uses shell:false, so
  // pipes/redirects/&& are unusable anyway except via a shell — agents must use
  // the allowed binaries directly instead.
  'make',
  'cmake',
  'gcc',
  'clang',
  'test',
  'true',
  'false',
]);

function isPathWithinWorkspace(workDir: string, resolved: string): boolean {
  const prefix = workDir.endsWith(path.sep) ? workDir : workDir + path.sep;
  return resolved === workDir || resolved.startsWith(prefix);
}

function parseTimeoutMs(raw: unknown): number {
  if (raw === undefined || raw === null) return DEFAULT_TIMEOUT_MS;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return n;
}

function parseCommand(raw: unknown): string[] | { error: string } {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { error: 'Command cannot be empty' };
    const parts: string[] = [];
    for (const part of raw) {
      if (typeof part !== 'string') return { error: 'Each command token must be a string' };
      parts.push(part);
    }
    return parts;
  }
  if (typeof raw === 'string') {
    if (raw.length === 0) return { error: 'Command cannot be empty' };
    if (raw.length > MAX_COMMAND_LENGTH) {
      return { error: `Command exceeds maximum length of ${MAX_COMMAND_LENGTH}` };
    }
    const tokens = raw.split(/\s+/).filter((t) => t.length > 0);
    return tokens;
  }
  return { error: 'Command must be string or string[]' };
}

export class BashTool implements ToolExecutor {
  readonly name = 'bash';
  readonly description =
    'Execute a shell command in the project workspace. Dangerous commands require explicit permission.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      command: {
        oneOf: [
          { type: 'string', description: 'Shell command tokens separated by whitespace' },
          {
            type: 'array',
            items: { type: 'string' },
            description: 'Shell command as array of tokens (preferred)',
          },
        ],
        description: 'Command to execute (string or array of tokens)',
      },
      cwd: { type: 'string', description: 'Working directory (must be within workspace)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
    },
    required: ['command'],
  };

  async execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `bash-${Date.now()}`;
    const validation = this.validateCommand(input);
    if (validation) return validation;
    const exec = this.resolveExecution(input, ctx);
    if ('error' in exec) return ToolResult.error(callId, exec.error);
    return this.runProcess(callId, exec, ctx.signal);
  }

  private validateCommand(input: Record<string, unknown>): ToolResult | null {
    const callId = `bash-${Date.now()}`;
    const parsed = parseCommand(input['command']);
    if ('error' in parsed) {
      return ToolResult.error(callId, parsed.error);
    }
    const tokens = parsed;
    const binary = tokens[0];
    if (!binary || !ALLOWED_BINARIES.has(binary)) {
      return ToolResult.error(callId, `Binary "${binary}" not in allowlist`);
    }
    for (const token of tokens) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(token)) {
          return ToolResult.error(
            callId,
            `Command blocked: contains forbidden pattern (${pattern.source})`
          );
        }
      }
    }
    return null;
  }

  private resolveExecution(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): { binary: string; args: string[]; cwd: string; timeoutMs: number } | { error: string } {
    const tokens = parseCommand(input['command']) as string[];
    const binary = tokens[0] ?? '';
    const args = tokens.slice(1);
    const workDir = ctx.workDir ?? process.cwd();
    let cwd = workDir;
    if (input['cwd']) {
      const requestedCwd = String(input['cwd']);
      const resolved = path.resolve(workDir, requestedCwd);
      if (!isPathWithinWorkspace(workDir, resolved)) {
        return { error: `cwd "${requestedCwd}" not allowed — must stay within workspace` };
      }
      cwd = resolved;
    }
    return { binary, args, cwd, timeoutMs: parseTimeoutMs(input['timeout']) };
  }

  private runProcess(
    callId: string,
    exec: { binary: string; args: string[]; cwd: string; timeoutMs: number },
    signal?: AbortSignal
  ): Promise<ToolResult> {
    return new Promise<ToolResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let aborted = false;
      const child = spawn(exec.binary, exec.args, { cwd: exec.cwd, shell: false });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, exec.timeoutMs);
      // P1-6: kill the subprocess when the request aborts (Stop button).
      const onAbort = () => {
        aborted = true;
        child.kill('SIGTERM');
      };
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (aborted) {
          resolve(ToolResult.error(callId, 'Command aborted'));
          return;
        }
        if (timedOut) {
          resolve(ToolResult.error(callId, `Command timed out`));
          return;
        }
        if (code !== 0) {
          resolve(ToolResult.error(callId, stderr || `Process exited with code ${code}`));
          return;
        }
        resolve(ToolResult.ok(callId, stdout));
      });
    });
  }
}
