import { DomainError } from '../errors/domain-error';

export class ToolCall {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly input: Record<string, unknown>,
  ) {}

  static create(id: string, name: string, input: Record<string, unknown>): ToolCall {
    if (!id) throw new DomainError('INVALID_TOOL_CALL', 'ToolCall: id is required');
    if (!name) throw new DomainError('INVALID_TOOL_CALL', 'ToolCall: name is required');
    return new ToolCall(id, name, input);
  }
}
