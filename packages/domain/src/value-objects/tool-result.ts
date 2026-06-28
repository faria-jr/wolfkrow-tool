import { DomainError } from '../errors/domain-error';

export class ToolResult {
  private constructor(
    readonly callId: string,
    readonly output: string,
    readonly isError: boolean
  ) {}

  static ok(callId: string, output: string): ToolResult {
    if (!callId) throw new DomainError('INVALID_TOOL_RESULT', 'ToolResult: callId is required');
    return new ToolResult(callId, output, false);
  }

  static error(callId: string, message: string): ToolResult {
    if (!callId) throw new DomainError('INVALID_TOOL_RESULT', 'ToolResult: callId is required');
    return new ToolResult(callId, message, true);
  }
}
