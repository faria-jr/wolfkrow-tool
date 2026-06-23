import type { ToolExecutor } from '@wolfkrow/domain';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class ToolRegistry {
  private readonly map: Map<string, ToolExecutor>;

  constructor(tools: ToolExecutor[] = []) {
    this.map = new Map(tools.map((t) => [t.name, t]));
  }

  get(name: string): ToolExecutor | undefined {
    return this.map.get(name);
  }

  forAgent(allowedTools: string[]): ToolExecutor[] {
    if (allowedTools.length === 0) return [...this.map.values()];
    return allowedTools.flatMap((name) => {
      const t = this.map.get(name);
      return t ? [t] : [];
    });
  }

  toDefinitions(allowedTools: string[]): ToolDefinition[] {
    return this.forAgent(allowedTools).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
}
