import { describe, expect, it } from 'vitest';

import {
  ChatStreamChunkSchema,
  PipelineStreamChunkSchema,
  HarnessStreamChunkSchema,
  DomainEventSchema,
  MessageSentEventSchema,
} from '../events';

describe('ChatStreamChunkSchema', () => {
  it('parses start event', () => {
    const event = {
      type: 'start' as const,
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      messageId: '550e8400-e29b-41d4-a716-446655440001',
      agent: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'test',
        model: 'sonnet',
      },
      timestamp: new Date(),
    };
    expect(ChatStreamChunkSchema.parse(event)).toBeDefined();
  });

  it('parses text event', () => {
    const event = {
      type: 'text' as const,
      content: 'Hello',
      timestamp: new Date(),
    };
    expect(ChatStreamChunkSchema.parse(event).type).toBe('text');
  });

  it('parses tool_call event', () => {
    const event = {
      type: 'tool_call' as const,
      id: 'toolu_123',
      name: 'Read',
      input: { file_path: '/test' },
      timestamp: new Date(),
    };
    expect(ChatStreamChunkSchema.parse(event).type).toBe('tool_call');
  });

  it('parses usage event with defaults', () => {
    const event = {
      type: 'usage' as const,
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      timestamp: new Date(),
    };
    const parsed = ChatStreamChunkSchema.parse(event);
    expect(parsed.type).toBe('usage');
    if (parsed.type === 'usage') {
      expect(parsed.cacheReadTokens).toBe(0);
      expect(parsed.cacheWriteTokens).toBe(0);
    }
  });

  it('parses done event', () => {
    const event = {
      type: 'done' as const,
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      messageId: '550e8400-e29b-41d4-a716-446655440001',
      totalUsage: { inputTokens: 100, outputTokens: 50, cost: 0.001 },
      timestamp: new Date(),
    };
    expect(ChatStreamChunkSchema.parse(event).type).toBe('done');
  });

  it('parses error event', () => {
    const event = {
      type: 'error' as const,
      message: 'Something failed',
      code: 'INTERNAL_ERROR',
      timestamp: new Date(),
    };
    expect(ChatStreamChunkSchema.parse(event).type).toBe('error');
  });

  it('rejects unknown event type', () => {
    expect(() =>
      ChatStreamChunkSchema.parse({ type: 'unknown', timestamp: new Date() })
    ).toThrow();
  });

  it('auto-fills timestamp if missing', () => {
    const event = ChatStreamChunkSchema.parse({ type: 'text', content: 'hi' });
    expect(event.timestamp).toBeInstanceOf(Date);
  });
});

describe('PipelineStreamChunkSchema', () => {
  it('parses message event', () => {
    const event = {
      type: 'message' as const,
      phaseId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'assistant' as const,
      content: 'Hello',
      timestamp: new Date(),
    };
    expect(PipelineStreamChunkSchema.parse(event)).toBeDefined();
  });

  it('parses phase_changed event', () => {
    const event = {
      type: 'phase_changed' as const,
      phaseId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'completed' as const,
      timestamp: new Date(),
    };
    expect(PipelineStreamChunkSchema.parse(event)).toBeDefined();
  });
});

describe('HarnessStreamChunkSchema', () => {
  it('parses round_started event', () => {
    const event = {
      type: 'round_started' as const,
      sprintId: '550e8400-e29b-41d4-a716-446655440000',
      featureIndex: 0,
      round: 1,
      timestamp: new Date(),
    };
    expect(HarnessStreamChunkSchema.parse(event)).toBeDefined();
  });

  it('parses message event', () => {
    const event = {
      type: 'message' as const,
      sprintId: '550e8400-e29b-41d4-a716-446655440000',
      agent: 'coder' as const,
      content: 'Implementing...',
      timestamp: new Date(),
    };
    expect(HarnessStreamChunkSchema.parse(event)).toBeDefined();
  });
});

describe('DomainEventSchema', () => {
  it('parses message.sent event', () => {
    const event = {
      type: 'message.sent' as const,
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      occurredAt: new Date(),
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      messageId: '550e8400-e29b-41d4-a716-446655440002',
      agentId: '550e8400-e29b-41d4-a716-446655440003',
      content: 'Hello',
    };
    expect(MessageSentEventSchema.parse(event)).toBeDefined();
  });

  it('discriminated union parses all event types', () => {
    const events = [
      {
        type: 'agent.created' as const,
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        occurredAt: new Date(),
        agentId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'test',
      },
      {
        type: 'document.ingest.completed' as const,
        eventId: '550e8400-e29b-41d4-a716-446655440002',
        occurredAt: new Date(),
        documentId: '550e8400-e29b-41d4-a716-446655440003',
        chunkCount: 100,
      },
    ];
    events.forEach((event) => {
      expect(DomainEventSchema.parse(event)).toBeDefined();
    });
  });
});
