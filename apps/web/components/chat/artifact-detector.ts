export type ArtifactType = 'excalidraw' | 'json' | 'code' | 'text';

/**
 * Detects the artifact type of a tool call output string.
 *
 * Priority order:
 * 1. 'excalidraw' — JSON with `type === "excalidraw"` AND `elements` array
 * 2. 'code'       — starts with triple backtick
 * 3. 'json'       — parseable JSON that is an object or array (not primitive)
 * 4. 'text'       — everything else
 */
export function detectArtifact(output: string): ArtifactType {
  // Code: starts with triple backtick
  if (output.trimStart().startsWith('```')) {
    return 'code';
  }

  // Try to parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return 'text';
  }

  // Only treat objects and arrays as meaningful JSON artifacts (not primitives)
  if (parsed === null || typeof parsed !== 'object') {
    return 'text';
  }

  // Excalidraw: object with type === "excalidraw" and elements as an array
  if (
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>)['type'] === 'excalidraw' &&
    Array.isArray((parsed as Record<string, unknown>)['elements'])
  ) {
    return 'excalidraw';
  }

  return 'json';
}
