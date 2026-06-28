/**
 * EPIC 4.2c — Capture the design artifact (HTML) from an OD project.
 *
 * Ported (minimal) from LionClaw snapshot.ts. The daemon exposes project files
 * via GET /api/projects/:id/files (+ /files/<path>); the design artifact is the
 * generated index.html. This locates + reads it. Full LionClaw snapshot also
 * writes a snapshot manifest + extracts the design-contract — contract
 * extraction + validation is the lock step (next increment).
 */

import type { FileEntry, OpenDesignClient } from './client';

export interface DesignSnapshot {
  html: string | null;
  artifactPath: string | null;
}

const HTML_CANDIDATES = [
  'index.html',
  'artifact/index.html',
  'public/index.html',
  'src/index.html',
];

function filePath(entry: FileEntry): string {
  return typeof entry.path === 'string' ? entry.path : '';
}

/** Pick the design HTML artifact path from a project's file list. */
export function findHtmlArtifact(files: readonly FileEntry[]): string | null {
  const byPath = new Set(files.map(filePath));
  for (const candidate of HTML_CANDIDATES) {
    if (byPath.has(candidate)) return candidate;
  }
  const firstHtml = files.map(filePath).find((p) => p.endsWith('.html'));
  return firstHtml ?? null;
}

/** Locate + read the design HTML artifact for an OD project (null if none yet). */
export async function captureDesignArtifact(
  client: OpenDesignClient,
  odProjectId: string
): Promise<DesignSnapshot> {
  const files = await client.getProjectFiles(odProjectId);
  const artifactPath = findHtmlArtifact(files);
  if (!artifactPath) return { html: null, artifactPath: null };
  const html = await client.getProjectFile(odProjectId, artifactPath);
  return { html, artifactPath };
}
