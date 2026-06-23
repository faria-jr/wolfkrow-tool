import { spawn } from 'node:child_process';
import * as path from 'node:path';

import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

const FORBIDDEN_PATTERNS = [/\bsudo\b/, /\bsu\s+/, /\bchmod\s+[0-9]*7/];
const DEFAULT_TIMEOUT_MS = 30_000;

export class BashTool implements ToolExecutor {
  readonly name = 'bash';
  readonly description = 'Execute a shell command in the project workspace. Dangerous commands require explicit permission.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (must be within workspace)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
    },
    required: ['command'],
  };

  async execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `bash-${Date.now()}`;
    const command = String(input['command'] ?? '');
    const timeoutMs = Number(input['timeout'] ?? DEFAULT_TIMEOUT_MS);

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(command)) {
        return ToolResult.error(callId, `Command blocked: contains forbidden pattern (${pattern.source})`);
      }
    }

    const workDir = ctx.workDir ?? process.cwd();
    let cwd = workDir;

    if (input['cwd']) {
      const requestedCwd = String(input['cwd']);
      const resolved = path.resolve(workDir, requestedCwd);
      if (!resolved.startsWith(workDir)) {
        return ToolResult.error(callId, `cwd "${requestedCwd}" not allowed — must stay within workspace`);
      }
      cwd = resolved;
    }

    return new Promise<ToolResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn('sh', ['-c', command], { cwd });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (timedOut) {
          resolve(ToolResult.error(callId, `Command timed out after ${timeoutMs}ms`));
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
