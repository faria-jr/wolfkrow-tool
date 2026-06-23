import { describe, expect, it } from 'vitest';

import { BashTool } from '../bash-tool';
import { FilesystemTool } from '../filesystem-tool';
import { ToolRegistry } from '../tool-registry';

describe('ToolRegistry', () => {
  it('registers and retrieves tools by name', () => {
    const registry = new ToolRegistry([new BashTool(), new FilesystemTool()]);
    expect(registry.get('bash')).toBeInstanceOf(BashTool);
    expect(registry.get('filesystem')).toBeInstanceOf(FilesystemTool);
  });

  it('returns undefined for unregistered tool', () => {
    const registry = new ToolRegistry([new BashTool()]);
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('forAgent returns only allowed tools', () => {
    const registry = new ToolRegistry([new BashTool(), new FilesystemTool()]);
    const tools = registry.forAgent(['bash']);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('bash');
  });

  it('forAgent with empty allowedTools returns all tools', () => {
    const registry = new ToolRegistry([new BashTool(), new FilesystemTool()]);
    const tools = registry.forAgent([]);
    expect(tools).toHaveLength(2);
  });

  it('toDefinitions returns JSON schema definitions', () => {
    const registry = new ToolRegistry([new BashTool()]);
    const defs = registry.toDefinitions(['bash']);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ name: 'bash', description: expect.any(String), input_schema: expect.any(Object) });
  });
});
