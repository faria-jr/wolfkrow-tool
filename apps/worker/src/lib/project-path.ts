/**
 * EPIC 1.1 — Path safety for the harness coder workspace.
 *
 * The harness coder runs bash/filesystem tools with `cwd = projectPath`, so an
 * unvalidated path is a file-system-write footgun. This guard rejects:
 *  - relative paths (must be absolute),
 *  - non-existent paths,
 *  - paths that are not directories,
 *  - paths outside the configured allowlist (when set),
 *  - symlinks that resolve outside the allowlist.
 *
 * Belongs in the worker (NOT domain) because it performs I/O (fs.realpath).
 *
 * Allowlist source: `WOLFKROW_ALLOWED_PROJECT_ROOTS` (comma-separated absolute
 * dirs). When unset, any existing absolute directory is accepted (developer
 * convenience) — configure the allowlist in production to constrain writes.
 */

import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

export type ProjectPathResult = { ok: true; path: string } | { ok: false; reason: string };

function parseAllowlist(): string[] | null {
  const raw = process.env['WOLFKROW_ALLOWED_PROJECT_ROOTS'];
  if (!raw) return null;
  const roots: string[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    // realpath the root so it compares in the same resolution space as the
    // candidate (macOS /var → /private/var, etc.). Skip missing entries.
    try {
      roots.push(realpathSync(resolve(trimmed)));
    } catch {
      // non-existent allowlist root — ignore (cannot match anything anyway)
    }
  }
  return roots.length > 0 ? roots : null;
}

function isWithin(child: string, roots: string[]): boolean {
  for (const root of roots) {
    if (child === root) return true;
    // prefix match on a path separator boundary so /allow/foo matches
    // /allow/foo/sub but not /allow-evil/x.
    if (child.startsWith(root + sep)) return true;
  }
  return false;
}

export function validateProjectPath(raw: string): ProjectPathResult {
  if (!raw || !isAbsolute(raw)) {
    return { ok: false, reason: 'projectPath must be an absolute path' };
  }

  let resolved: string;
  let stats: ReturnType<typeof statSync>;
  try {
    // realpath resolves symlinks so a link inside the allowlist that points
    // outside is rejected.
    resolved = realpathSync(raw);
    stats = statSync(resolved);
  } catch {
    return { ok: false, reason: 'projectPath does not exist' };
  }

  if (!stats.isDirectory()) {
    return { ok: false, reason: 'projectPath must be a directory' };
  }

  const roots = parseAllowlist();
  if (roots && !isWithin(resolved, roots)) {
    return { ok: false, reason: 'projectPath is outside the configured allowlist' };
  }

  return { ok: true, path: resolved };
}
