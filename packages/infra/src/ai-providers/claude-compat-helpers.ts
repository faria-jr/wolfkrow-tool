import type Anthropic from '@anthropic-ai/sdk';

import type { ImagePart, StreamChunk } from './types';

export type ToolUseBlock = { id: string; name: string; partialJson: string };

export interface StreamEventsResult {
  toolUseBlocks: Map<string, ToolUseBlock>;
  usage: Anthropic.Messages.Usage;
  stopReason: string | null;
  assistantContent: Anthropic.Messages.ContentBlock[];
}

export async function* processStreamEvents(
  stream: ReturnType<Anthropic['messages']['stream']>,
): AsyncGenerator<StreamChunk, StreamEventsResult> {
  const toolUseBlocks = new Map<string, ToolUseBlock>();
  let currentToolId: string | null = null;

  for await (const event of stream) {
    const started = beginToolUse(event);
    if (started) {
      currentToolId = started.id;
      toolUseBlocks.set(started.id, started);
      continue;
    }
    const text = extractTextDelta(event);
    if (text !== undefined) {
      yield { delta: text };
      continue;
    }
    appendToolJson(event, currentToolId, toolUseBlocks);
    if (event.type === 'content_block_stop') currentToolId = null;
  }

  const final = await stream.finalMessage();
  return {
    toolUseBlocks,
    usage: final.usage,
    stopReason: final.stop_reason,
    assistantContent: final.content,
  };
}

function beginToolUse(event: Anthropic.Messages.RawMessageStreamEvent): ToolUseBlock | null {
  if (event.type !== 'content_block_start') return null;
  const block = (event as { content_block: Anthropic.Messages.ContentBlock }).content_block;
  if (block.type !== 'tool_use') return null;
  return { id: block.id, name: block.name, partialJson: '' };
}

function extractTextDelta(event: Anthropic.Messages.RawMessageStreamEvent): string | undefined {
  if (event.type !== 'content_block_delta') return undefined;
  const delta = (event as { delta: Anthropic.Messages.RawContentBlockDelta }).delta;
  return delta.type === 'text_delta' ? delta.text : undefined;
}

function appendToolJson(
  event: Anthropic.Messages.RawMessageStreamEvent,
  currentToolId: string | null,
  toolUseBlocks: Map<string, ToolUseBlock>,
): void {
  if (event.type !== 'content_block_delta' || !currentToolId) return;
  const delta = (event as { delta: Anthropic.Messages.RawContentBlockDelta }).delta;
  if (delta.type !== 'input_json_delta') return;
  const blk = toolUseBlocks.get(currentToolId);
  if (blk) blk.partialJson += delta.partial_json;
}

export async function* drainTextStream(
  stream: ReturnType<Anthropic['messages']['stream']>,
): AsyncIterable<StreamChunk> {
  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    yield {
      delta: '',
      done: true,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    };
  } catch (err) {
    yield { delta: '', done: true };
    throw err;
  }
}

export function parseJson(partial: string): Record<string, unknown> {
  if (!partial) return {};
  try {
    return JSON.parse(partial) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function toMessageParams(options: { messages: { role: string; content: string }[] }): Anthropic.Messages.MessageParam[] {
  return options.messages.filter((m) => m.role !== 'system').map(toAnthropicMessage);
}

function toAnthropicMessage(message: { role: string; content: string }): Anthropic.Messages.MessageParam {
  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  };
}

export function injectImageParts(
  messages: Anthropic.Messages.MessageParam[],
  parts: ImagePart[],
): void {
  const lastUserIdx = messages.reduce(
    (found, m, i) => (m.role === 'user' ? i : found),
    -1,
  );
  if (lastUserIdx < 0) return;

  const lastMsg = messages[lastUserIdx];
  if (!lastMsg) return;
  const text = typeof lastMsg.content === 'string' ? (lastMsg.content as string) : '';

  const imageBlocks: Anthropic.Messages.ImageBlockParam[] = parts.map((p) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: p.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: p.data,
    },
  }));

  messages[lastUserIdx] = {
    role: 'user',
    content: [...imageBlocks, { type: 'text', text }],
  };
}
