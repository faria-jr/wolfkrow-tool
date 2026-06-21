import { describe, expect, it } from 'vitest';

import {
  ChatMessageSchema,
  ChatSessionSchema,
  SendMessageInputSchema,
  ToolCallSchema,
  ToolResultSchema,
} from '../schemas/chat';

describe('ToolCallSchema', () => {
  it('accepts valid tool call', () => {
    const call = {
      id: 'toolu_123',
      name: 'Read',
      input: { file_path: '/test.txt' },
    };
    expect(ToolCallSchema.parse(call)).toEqual(call);
  });

  it('rejects empty name', () => {
    expect(() =>
      ToolCallSchema.parse({ id: 'x', name: '', input: {} })
    ).toThrow();
  });
});

describe('ToolResultSchema', () => {
  it('defaults isError to false', () => {
    const result = ToolResultSchema.parse({
      toolCallId: 'toolu_123',
      output: 'file content',
    });
    expect(result.isError).toBe(false);
  });
});

describe('ChatMessageSchema', () => {
  const valid = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440002',
    role: 'user' as const,
    content: 'Hello',
    attachments: [],
    toolCalls: [],
    toolResults: [],
    metadata: {},
    createdAt: new Date(),
  };

  it('accepts valid message', () => {
    expect(ChatMessageSchema.parse(valid)).toEqual(valid);
  });

  it('accepts all valid roles', () => {
    (['user', 'assistant', 'system', 'tool'] as const).forEach((role) => {
      expect(ChatMessageSchema.parse({ ...valid, role }).role).toBe(role);
    });
  });

  it('rejects invalid role', () => {
    expect(() => ChatMessageSchema.parse({ ...valid, role: 'admin' })).toThrow();
  });
});

describe('ChatSessionSchema', () => {
  it('validates a session', () => {
    const session = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      agentId: '550e8400-e29b-41d4-a716-446655440002',
      title: 'New chat',
      archived: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivity: new Date(),
    };
    expect(ChatSessionSchema.parse(session)).toBeDefined();
  });
});

describe('SendMessageInputSchema', () => {
  it('accepts minimal input', () => {
    const parsed = SendMessageInputSchema.parse({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Hello',
    });
    expect(parsed.attachments).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });

  it('accepts optional sessionId', () => {
    expect(
      SendMessageInputSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Test',
      })
    ).toBeDefined();
  });
});
