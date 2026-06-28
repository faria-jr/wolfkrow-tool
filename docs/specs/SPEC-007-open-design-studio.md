# SPEC-007: Open Design Studio (Sidecar)

**Status**: 📝 Draft
**Camada**: Sidecar (Next.js standalone) + Worker (manager)
**Prioridade**: P2 (nice-to-have)

---

## 1. Visão Geral

Sub-app Next.js independente para design de interfaces (wireframes, mockups, prototypes). Roda em porta 5000, gerenciado pelo Worker.

### Substitui

`vendor/open-design/` (106MB versionado) → `apps/sidecar/` (independente)

### Funcionalidades

- Canvas interativo (Excalidraw-like)
- Design templates
- Design systems registry
- Versioning
- Export para SPEC.md

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────┐
│         apps/sidecar/ (Next.js 15)          │
│                                              │
│  - Canvas (react-konva ou tldraw)           │
│  - Templates library                         │
│  - Design system registry                    │
│  - Export to Markdown                        │
│  - Standalone (porta 5000)                   │
└──────────────────┬───────────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────────┐
│         apps/worker/                         │
│                                              │
│  OpenDesignManager                           │
│  ├─ spawn sidecar process (port 5000)        │
│  ├─ health check                             │
│  ├─ auth proxy (cookies shared)              │
│  └─ lifecycle (start/stop/restart)            │
└─────────────────────────────────────────────┘
```

---

## 3. Sidecar Lifecycle

```typescript
// apps/worker/src/pipeline/open-design-manager.ts
export class OpenDesignManager {
  private process?: ChildProcess;

  async start(): Promise<void> {
    const sidecarPath = path.resolve('apps/sidecar');

    this.process = spawn('node', [path.join(sidecarPath, 'server.js')], {
      env: {
        ...process.env,
        PORT: '5000',
        NODE_ENV: process.env.NODE_ENV,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for health
    await this.waitForHealth(30_000);
  }

  async stop(): Promise<void> {
    this.process?.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1000));
    this.process?.kill('SIGKILL');
  }

  private async waitForHealth(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch('http://localhost:5000/api/health');
        if (res.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('Open Design sidecar failed to start');
  }
}
```

---

## 4. UI Integration (iframe)

```tsx
// apps/web/components/open-design/OpenDesignViewer.tsx
'use client';
export function OpenDesignViewer({ projectId }: { projectId: string }) {
  return (
    <iframe
      src={`http://localhost:5000/?project=${projectId}&token=${getAuthToken()}`}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}
```

---

## 5. Features Detalhadas

### Canvas

- Drag-and-drop shapes (rectangle, circle, arrow, text)
- Layers (z-index, lock/unlock, hide/show)
- Multi-select, group/ungroup
- Undo/redo (50 steps)
- Pan, zoom, fit-to-screen

### Templates

- Wireframe (low-fi)
- Mockup (high-fi)
- User Flow (with arrows)
- IA (sitemap)

### Design Systems

- Material UI tokens
- shadcn/ui tokens
- Wolfkrow tokens (default)
- Custom user-defined

### Export

- PNG / SVG
- Markdown (ASCII wireframe + description)
- Figma JSON (basic)

---

## 6. Database Schema

```typescript
export const designProjects = sqliteTable('design_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  canvasData: text('canvas_data', { mode: 'json' }).$type<CanvasData>(),
  thumbnail: text('thumbnail'), // base64 PNG
  template: text('template'),
  designSystem: text('design_system'),
  version: integer('version').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const designTemplates = sqliteTable('design_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', { enum: ['wireframe', 'mockup', 'userflow', 'ia'] }),
  thumbnail: text('thumbnail'),
  data: text('data', { mode: 'json' }),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).default(false),
});
```

---

## 7. Testes

- Sidecar startup + health check
- Canvas CRUD operations
- Template loading
- Export functionality
- iframe sandboxing security
