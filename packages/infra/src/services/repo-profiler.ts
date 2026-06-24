import { readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { RepoProfile } from '@wolfkrow/domain';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.next', 'dist', 'build', '.cache']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.cs']);

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.cs': 'csharp',
};

const FRAMEWORK_DEPS: Array<{ dep: string; name: string }> = [
  { dep: 'next', name: 'nextjs' },
  { dep: 'nuxt', name: 'nuxt' },
  { dep: 'react', name: 'react' },
  { dep: 'vue', name: 'vue' },
  { dep: 'fastify', name: 'fastify' },
  { dep: 'express', name: 'express' },
  { dep: 'nestjs', name: 'nestjs' },
  { dep: 'fastapi', name: 'fastapi' },
  { dep: 'django', name: 'django' },
  { dep: 'flask', name: 'flask' },
];

const PATH_ROLE_HINTS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /routes?\/|handlers?\/|controllers?\//i, role: 'api' },
  { pattern: /components?\/|pages?\/|views?\//i, role: 'ui' },
  { pattern: /services?\/|use[-_]?cases?\//i, role: 'service' },
  { pattern: /repositories?\/|repos?\//i, role: 'repository' },
  { pattern: /entities\/|models?\/|domain\//i, role: 'domain' },
  { pattern: /migrations?\/|schema\//i, role: 'database' },
  { pattern: /tests?\/|__tests__\/|spec\//i, role: 'test' },
];

export class RepoProfilerService {
  async profile(root: string): Promise<RepoProfile> {
    const files = this.collectFiles(root);
    const languages = this.detectLanguages(files);
    const frameworks = this.detectFrameworks(root);
    const roles = this.classifyRoles(root, files);

    return RepoProfile.create({
      root,
      languages: [...languages],
      frameworks: [...frameworks],
      roles,
      fileCount: files.length,
    });
  }

  private collectFiles(root: string, dir = root, out: string[] = []): string[] {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }

    for (const entry of entries) {
      const name = String(entry.name);
      if (EXCLUDED_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (entry.isDirectory()) {
        this.collectFiles(root, full, out);
      } else if (entry.isFile()) {
        try {
          const stat = statSync(full);
          if (stat.size <= 1_048_576) out.push(relative(root, full));
        } catch {
          // skip unreadable
        }
      }
    }
    return out;
  }

  private detectLanguages(files: string[]): Set<string> {
    const langs = new Set<string>();
    for (const f of files) {
      const lang = LANGUAGE_BY_EXT[extname(f).toLowerCase()];
      if (lang) langs.add(lang);
    }
    return langs;
  }

  private detectFrameworks(root: string): Set<string> {
    const fws = new Set<string>();
    const pkgPath = join(root, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, Record<string, string>>;
      const allDeps = { ...pkg['dependencies'], ...pkg['devDependencies'], ...pkg['peerDependencies'] };
      for (const { dep, name } of FRAMEWORK_DEPS) {
        if (dep in allDeps) fws.add(name);
      }
    } catch {
      // no package.json or invalid JSON
    }
    return fws;
  }

  private classifyRoles(_root: string, files: string[]): Record<string, string[]> {
    const roleMap: Record<string, string[]> = {};
    for (const f of files) {
      if (!SOURCE_EXTENSIONS.has(extname(f).toLowerCase())) continue;
      for (const { pattern, role } of PATH_ROLE_HINTS) {
        if (pattern.test(f)) {
          (roleMap[role] ??= []).push(f);
          break;
        }
      }
    }
    return roleMap;
  }
}
