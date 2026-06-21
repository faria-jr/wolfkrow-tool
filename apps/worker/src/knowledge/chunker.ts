import type { ChunkMetadata, ChunkSourceType } from '@wolfkrow/domain';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

export interface RawChunk {
  content: string;
  metadata: ChunkMetadata;
}

function makeMetadata(sourceType: ChunkSourceType, heading: string, position: number): ChunkMetadata {
  const meta: ChunkMetadata = { sourceType, position };
  if (heading) meta.heading = heading;
  return meta;
}

function flush(chunks: RawChunk[], content: string, heading: string, type: ChunkSourceType): void {
  const trimmed = content.trim();
  if (trimmed) chunks.push({ content: trimmed, metadata: makeMetadata(type, heading, chunks.length) });
}

export function semanticChunk(text: string, maxSize = 1000): RawChunk[] {
  if (!text.trim()) return [];

  const chunks: RawChunk[] = [];
  const tree = remark().use(remarkGfm).parse(text);
  let current = '';
  let currentHeading = '';
  let currentType: ChunkSourceType = 'paragraph';

  visit(tree, (node) => {
    const nodeType = node.type;

    if (nodeType === 'heading') {
      if (current.trim()) {
        flush(chunks, current, currentHeading, currentType);
        current = '';
      }
      currentHeading = toString(node);
      currentType = 'heading';
      return;
    }

    if (['paragraph', 'code', 'list', 'table'].includes(nodeType)) {
      const content = toString(node);
      const type: ChunkSourceType =
        nodeType === 'code' ? 'code'
        : nodeType === 'list' ? 'list'
        : nodeType === 'table' ? 'table'
        : 'paragraph';

      if (current.length + content.length > maxSize && current.trim()) {
        flush(chunks, current, currentHeading, currentType);
        current = content;
        currentType = type;
      } else {
        if (!current) currentType = type;
        current += (current ? '\n\n' : '') + content;
      }
    }
  });

  if (current.trim()) flush(chunks, current, currentHeading, currentType);

  return chunks.map((c, i) => ({ ...c, metadata: { ...c.metadata, position: i } }));
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
