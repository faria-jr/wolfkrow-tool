import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

import type { ArtifactWriter } from '@wolfkrow/domain';

/**
 * persists pipeline phase artifacts (assistant output) to disk and returns
 * the absolute path. The path is stored on PipelinePhase.artifactPath.
 *
 * Keys may contain `/` (e.g. `projectId/phaseId-stage`); each segment is
 * sanitized and the final path is confined to `baseDir` (no traversal).
 */
export class FsArtifactWriter implements ArtifactWriter {
 constructor(
 private readonly baseDir: string =
 process.env['WOLFKROW_ARTIFACTS_DIR'] ?? join(process.cwd(), '.wolfkrow', 'artifacts'),
 ) {}

 async write(key: string, content: string): Promise<string> {
 const safe = key
 .split('/')
 .map((s) => s.replace(/[^a-zA-Z0-9-_]/g, '_'))
 .join('/');
 const base = normalize(this.baseDir);
 const filePath = normalize(join(base, `${safe}.md`));
 if (!filePath.startsWith(base)) {
 throw new Error(`Artifact key escapes base dir: ${key}`);
 }
 await mkdir(dirname(filePath), { recursive: true });
 await writeFile(filePath, content, 'utf8');
 return filePath;
 }
}
