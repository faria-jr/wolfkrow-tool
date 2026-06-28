import type { ChunkMetadata, ChunkSourceType } from '@wolfkrow/domain';
import { toString } from 'mdast-util-to-string';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

export interface RawChunk {
  content: string;
  metadata: ChunkMetadata;
}

function makeMetadata(
  sourceType: ChunkSourceType,
  heading: string,
  position: number
): ChunkMetadata {
  const meta: ChunkMetadata = { sourceType, position };
  if (heading) meta.heading = heading;
  return meta;
}

function flush(chunks: RawChunk[], content: string, heading: string, type: ChunkSourceType): void {
  const trimmed = content.trim();
  if (trimmed)
    chunks.push({ content: trimmed, metadata: makeMetadata(type, heading, chunks.length) });
}

function resolveChunkType(nodeType: string): ChunkSourceType {
  if (nodeType === 'code') return 'code';
  if (nodeType === 'list') return 'list';
  if (nodeType === 'table') return 'table';
  return 'paragraph';
}

interface ChunkState {
  current: string;
  currentHeading: string;
  currentType: ChunkSourceType;
  chunks: RawChunk[];
  maxSize: number;
}

function appendContent(state: ChunkState, content: string, type: ChunkSourceType): void {
  if (state.current.length + content.length > state.maxSize && state.current.trim()) {
    flush(state.chunks, state.current, state.currentHeading, state.currentType);
    state.current = content;
    state.currentType = type;
    return;
  }
  if (!state.current) state.currentType = type;
  state.current += (state.current ? '\n\n' : '') + content;
}

export function semanticChunk(text: string, maxSize = 1000): RawChunk[] {
  if (!text.trim()) return [];

  const state: ChunkState = {
    current: '',
    currentHeading: '',
    currentType: 'paragraph',
    chunks: [],
    maxSize,
  };
  const tree = remark().use(remarkGfm).parse(text);

  visit(tree, (node) => {
    const nodeType = node.type;

    if (nodeType === 'heading') {
      if (state.current.trim()) {
        flush(state.chunks, state.current, state.currentHeading, state.currentType);
        state.current = '';
      }
      state.currentHeading = toString(node);
      state.currentType = 'heading';
      return;
    }

    if (['paragraph', 'code', 'list', 'table'].includes(nodeType)) {
      appendContent(state, toString(node), resolveChunkType(nodeType));
    }
  });

  if (state.current.trim())
    flush(state.chunks, state.current, state.currentHeading, state.currentType);

  return state.chunks.map((c, i) => ({ ...c, metadata: { ...c.metadata, position: i } }));
}

export function rawChunk(text: string, maxSize = 1000): RawChunk[] {
  if (!text.trim()) return [];
  const chunks: RawChunk[] = [];
  let pos = 0;
  for (let i = 0; i < text.length; i += maxSize) {
    const content = text.slice(i, i + maxSize).trim();
    if (content) chunks.push({ content, metadata: { sourceType: 'raw', position: pos++ } });
  }
  return chunks;
}
