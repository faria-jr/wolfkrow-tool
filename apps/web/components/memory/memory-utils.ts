import type { MemoryData } from './memory-types';

export function buildCompactionContent(memories: MemoryData[]): string {
  const recent = memories.slice(0, 20);
  if (recent.length === 0) {
    return 'Manual compaction — no memories to summarize.';
  }
  return `Compaction of ${recent.length} recent memories:\n\n${recent.map((m) => `• ${m.content}`).join('\n')}`;
}
