import { existsSync, readFileSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';

import type { BrokenImport } from './smoke-test-runner';

const MAX_FILE_SIZE = 1_048_576;
const MAX_WALK_FILES = 10_000;

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.wolfkrow',
  'out',
  '.next',
  '.cache',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const RESOLVE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '/index.ts',
  '/index.tsx',
  '/index.js',
];

const IMPORT_RE = /(?:^|\n)\s*import\s+[^'"]*['"](\.\.?\/[^'"]+)['"]/g;
const EXPORT_RE = /(?:^|\n)\s*(?:export\s+\*\s+from|export\s+\{[^}]*\}\s+from)\s*['"](\.\.?\/[^'"]+)['"]/g;

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name);
}

function tryCollectFile(
  entry: Dirent,
  fullPath: string,
  name: string,
  results: string[],
): void {
  if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(name))) return;
  try {
    if (statSync(fullPath).size <= MAX_FILE_SIZE) results.push(fullPath);
  } catch {
    // skip
  }
}

function walkDir(dir: string, results: string[], count: { value: number }): void {
  if (count.value >= MAX_WALK_FILES) return;
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (count.value >= MAX_WALK_FILES) return;
    const name = String(entry.name);
    if (shouldSkipDir(name)) continue;
    const fullPath = join(dir, name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results, count);
    } else {
      tryCollectFile(entry, fullPath, name, results);
      count.value += 1;
    }
  }
}

function collectSourceFiles(projectPath: string): string[] {
  const files: string[] = [];
  walkDir(projectPath, files, { value: 0 });
  return files;
}

function resolveImport(fromDir: string, importPath: string): boolean {
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = resolve(fromDir, importPath + ext);
    if (existsSync(candidate)) return true;
  }
  return false;
}

function relativePath(filePath: string, projectPath: string): string {
  return filePath.startsWith(projectPath + sep)
    ? filePath.slice(projectPath.length + 1)
    : filePath;
}

function extractImports(content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(content)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function scanFileForBroken(
  filePath: string,
  projectPath: string,
  broken: BrokenImport[],
): void {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }
  const fromDir = dirname(filePath);
  const relFile = relativePath(filePath, projectPath);
  for (const imp of extractImports(content)) {
    if (!resolveImport(fromDir, imp)) {
      broken.push({ file: relFile, importPath: imp });
    }
  }
}

export function checkBrokenImports(projectPath: string): BrokenImport[] {
  const broken: BrokenImport[] = [];
  try {
    const files = collectSourceFiles(projectPath);
    for (const filePath of files) {
      scanFileForBroken(filePath, projectPath, broken);
    }
  } catch {
    // walk failed; return what we have
  }
  return broken;
}

export function checkMissingFiles(projectPath: string, expectedFiles: string[]): string[] {
  const missing: string[] = [];
  for (const p of expectedFiles) {
    try {
      if (!existsSync(resolve(projectPath, p))) missing.push(p);
    } catch {
      missing.push(p);
    }
  }
  return missing;
}