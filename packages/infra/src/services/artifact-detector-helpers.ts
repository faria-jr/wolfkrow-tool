import { readFileSync, statSync } from 'node:fs';

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function firstString(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function findAudioInContent(content: string): { audioPath: string; mimeType: string } | null {
  const audioMatch = content.match(/ARQUIVO_AUDIO:\s*((?:\/|[A-Za-z]:\\).+?)(?:\n|$)/);
  if (!audioMatch?.[1]) return null;
  const audioPath = audioMatch[1].trim();
  try {
    const stat = statSync(audioPath);
    if (!stat.isFile()) return null;
    return { audioPath, mimeType: 'audio/mpeg' };
  } catch {
    return null;
  }
}

export function readAudioAsBase64(p: string): string | null {
  try {
    return readFileSync(p).toString('base64');
  } catch {
    return null;
  }
}
