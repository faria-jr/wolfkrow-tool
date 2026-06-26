/**
 * EPIC 4.2c — HTTP client for the vendored open-design daemon.
 *
 * Ported from LionClaw's adapter-http.ts (the portable contract). The daemon
 * (nexu-io "open-design" v0.6.0) exposes a local HTTP API (default :7456) for
 * project/conversation/file/run management. All design orchestration is HTTP +
 * file I/O — no Electron. Wolfkrow's worker drives the daemon through this
 * client; the web app iframes the engine's web UI separately.
 *
 * Minimal surface for now: health, project CRUD, file access. Bootstrap/lock/
 * snapshot (the heavier LionClaw flows) layer on top of this client next.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export interface OpenDesignProject {
  id: string;
  name: string;
  skillId: string | null;
  designSystemId: string | null;
  metadata: { kind: string; fidelity: string; source: string };
  createdAt: number;
  updatedAt: number;
  status?: { value: string };
}

export interface CreateProjectInput {
  id: string;
  name: string;
  skillId?: string | null;
  designSystemId?: string | null;
  pendingPrompt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectResult {
  project: OpenDesignProject;
  conversationId: string;
}

export interface FileEntry {
  path: string;
  [key: string]: unknown;
}

export class OpenDesignClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async health(): Promise<{ ok: boolean; version: string }> {
    return this.getJson('/api/health');
  }

  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    return this.postJson<CreateProjectResult>('/api/projects', input);
  }

  async listProjects(): Promise<OpenDesignProject[]> {
    const r = await this.getJson<{ projects: OpenDesignProject[] }>('/api/projects');
    return r.projects ?? [];
  }

  async getProject(id: string): Promise<OpenDesignProject> {
    return this.getJson(`/api/projects/${encodeURIComponent(id)}`);
  }

  async getProjectFiles(id: string): Promise<FileEntry[]> {
    const r = await this.getJson<{ files: FileEntry[] }>(`/api/projects/${encodeURIComponent(id)}/files`);
    return r.files ?? [];
  }

  async getProjectFile(id: string, filePath: string): Promise<string> {
    const res = await this.fetch(`/api/projects/${encodeURIComponent(id)}/files/${encodeURI(filePath)}`);
    if (!res.ok) throw new Error(`open-design getProjectFile ${filePath} failed: HTTP ${res.status}`);
    return res.text();
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetch(path);
    if (!res.ok) throw new Error(`open-design GET ${path} failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`open-design POST ${path} failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
