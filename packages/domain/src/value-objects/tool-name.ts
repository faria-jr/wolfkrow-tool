import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

// "Read", "Write", "mcp__google-calendar__create_event", "bash".
const toolNameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z][a-zA-Z0-9_:.-]{0,63}$/);

/** Nome de tool (built-in ou MCP namespaced). */
export class ToolName extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): ToolName {
    const result = toolNameSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('toolName', result.error);
    return new ToolName(result.data);
  }
}
