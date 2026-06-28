import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

type FsOperation = 'read' | 'write' | 'glob' | 'grep';

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class FilesystemTool implements ToolExecutor {
  readonly name = 'filesystem';
  readonly description = 'Read, write and search files within the project workspace.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['read', 'write', 'glob', 'grep'] },
      path: { type: 'string', description: 'Relative path within workspace (read/write)' },
      content: { type: 'string', description: 'File content (write only)' },
      pattern: { type: 'string', description: 'Glob or regex pattern (glob/grep)' },
      searchPath: { type: 'string', description: 'Path to search within (grep, default: .)' },
    },
    required: ['operation'],
  };

  async execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `fs-${Date.now()}`;
    const op = String(input['operation'] ?? '') as FsOperation;
    const workDir = ctx.workDir ?? process.cwd();
    try {
      switch (op) {
        case 'read':
          return await this.handleRead(input, workDir, callId);
        case 'write':
          return await this.handleWrite(input, workDir, callId);
        case 'glob':
          return await this.handleGlob(input, workDir, callId);
        case 'grep':
          return await this.handleGrep(input, workDir, callId);
        default:
          return ToolResult.error(callId, `Unknown operation: ${op}`);
      }
    } catch (err) {
      return ToolResult.error(callId, toErrorMessage(err));
    }
  }

  private async handleRead(
    input: Record<string, unknown>,
    workDir: string,
    callId: string
  ): Promise<ToolResult> {
    const filePath = this.resolveAndValidate(String(input['path'] ?? ''), workDir, callId);
    if (filePath instanceof ToolResult) return filePath;
    const content = await fs.readFile(filePath, 'utf-8');
    return ToolResult.ok(callId, content);
  }

  private async handleWrite(
    input: Record<string, unknown>,
    workDir: string,
    callId: string
  ): Promise<ToolResult> {
    const filePath = this.resolveAndValidate(String(input['path'] ?? ''), workDir, callId);
    if (filePath instanceof ToolResult) return filePath;
    const content = String(input['content'] ?? '');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return ToolResult.ok(callId, `Written: ${path.relative(workDir, filePath)}`);
  }

  private async handleGlob(
    input: Record<string, unknown>,
    workDir: string,
    callId: string
  ): Promise<ToolResult> {
    const pattern = String(input['pattern'] ?? '**/*');
    const files = await this.glob(pattern, workDir);
    return ToolResult.ok(callId, files.join('\n'));
  }

  private async handleGrep(
    input: Record<string, unknown>,
    workDir: string,
    callId: string
  ): Promise<ToolResult> {
    const pattern = String(input['pattern'] ?? '');
    const searchIn = String(input['searchPath'] ?? '.');
    const searchPath = this.resolveAndValidate(searchIn, workDir, callId);
    if (searchPath instanceof ToolResult) return searchPath;
    const results = await this.grep(pattern, searchPath);
    return ToolResult.ok(callId, results.join('\n') || '(no matches)');
  }

  private resolveAndValidate(
    filePath: string,
    workDir: string,
    callId: string
  ): string | ToolResult {
    if (!filePath) return ToolResult.error(callId, 'path is required');
    const resolved = path.resolve(workDir, filePath);
    if (!resolved.startsWith(workDir)) {
      return ToolResult.error(
        callId,
        `Path "${filePath}" not allowed — must stay within workspace`
      );
    }
    return resolved;
  }

  private async glob(pattern: string, dir: string): Promise<string[]> {
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*\//g, '(?:.+/)?')
      .replace(/\*/g, '[^/]*');
    const regex = new RegExp(`^${regexStr}$`);
    const all = await fs.readdir(dir, { recursive: true, encoding: 'utf-8' });
    return (all as string[]).filter((f) => regex.test(f)).sort();
  }

  private async grep(pattern: string, searchPath: string): Promise<string[]> {
    const regex = new RegExp(pattern);
    const results: string[] = [];

    async function walk(dirOrFile: string): Promise<void> {
      const stat = await fs.stat(dirOrFile).catch(() => null);
      if (!stat) return;
      if (stat.isDirectory()) {
        const entries = await fs.readdir(dirOrFile);
        await Promise.all(entries.map((e) => walk(path.join(dirOrFile, e))));
      } else {
        const content = await fs.readFile(dirOrFile, 'utf-8').catch(() => '');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (regex.test(line)) results.push(`${dirOrFile}:${i + 1}: ${line}`);
        });
      }
    }

    await walk(searchPath);
    return results;
  }
}
