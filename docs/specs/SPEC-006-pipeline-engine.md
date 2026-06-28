# SPEC-006: Pipeline Engine (BuildPlan)

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P1 (importante)

---

## 1. Visão Geral

Multi-stage workflow: **discovery → spec-build → spec-validate → approval → implementation**. Mais conversacional que Harness (user participa em cada fase).

### Stages

1. **Discovery**: Agent entrevista user para entender problema
2. **Spec Build**: Gera PRD + SPEC baseado em discovery
3. **Spec Validate**: Architecture review + tech spec validation
4. **User Approval**: User aprova, rejeita, ou pede edits
5. **Implementation**: Chama Harness system para implementar

---

## 2. Database Schema

```typescript
export const pipelineProjects = sqliteTable('pipeline_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  currentStage: text('current_stage', {
    enum: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation', 'completed'],
  }).notNull(),
  status: text('status', {
    enum: ['running', 'paused', 'awaiting_approval', 'completed', 'failed', 'cancelled'],
  }).notNull(),
  discoveryNotes: text('discovery_notes'),
  specPath: text('spec_path'),
  prdPath: text('prd_path'),
  approvalNotes: text('approval_notes'),
  metrics: text('metrics', { mode: 'json' }).$type<PipelineMetrics>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const pipelinePhases = sqliteTable('pipeline_phases', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => pipelineProjects.id, { onDelete: 'cascade' }),
  stage: text('stage', {
    enum: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation'],
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'in_progress', 'awaiting_user', 'completed', 'failed', 'skipped'],
  }).notNull(),
  artifactPath: text('artifact_path'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  metrics: text('metrics', { mode: 'json' }).$type<PhaseMetrics>().default({}),
});

export const pipelineMessages = sqliteTable('pipeline_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => pipelineProjects.id, { onDelete: 'cascade' }),
  phaseId: text('phase_id')
    .notNull()
    .references(() => pipelinePhases.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 3. State Machine

```
                    ┌──────────────────┐
                    │   discovery      │
                    │   (interview)    │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │   spec_build     │
                    │   (PRD + SPEC)   │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
        ┌──────────→│  spec_validate   │
        │           │   (arch review)  │
        │           └────────┬─────────┘
        │                    ↓
        │           ┌──────────────────┐
        │     ┌────→│   approval       │←──┐
        │     │     │   (user review)  │   │
        │     │     └────────┬─────────┘   │
        │  reject         approve           │ edit
        │     │             ↓               │
        │     └─────────────┴───────────────┘
        │                  ↓
        │         ┌──────────────────┐
        │         │  implementation  │
        │         │  (harness)       │
        │         └────────┬─────────┘
        │                  ↓
        │         ┌──────────────────┐
        └─────────│   completed      │
                  └──────────────────┘
```

---

## 4. Stage Implementations

### Discovery Stage

```typescript
// apps/worker/src/pipeline/stages/discovery.stage.ts
export class DiscoveryStage {
  constructor(
    private provider: AIProvider,
    private messageRepo: PipelineMessageRepo
  ) {}

  async *execute(projectId: string, phaseId: string): AsyncIterable<PipelineEvent> {
    const messages = await this.messageRepo.listByPhase(phaseId);

    const prompt: Prompt = {
      system: DISCOVERY_SYSTEM_PROMPT,
      messages: [
        { role: 'system', content: 'You are conducting a product discovery interview.' },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      tools: [AskUserQuestionTool],
      model: 'claude-sonnet-4-5',
      maxTokens: 4000,
    };

    for await (const chunk of this.provider.query(prompt)) {
      if (chunk.type === 'text') {
        yield { type: 'message', phaseId, role: 'assistant', content: chunk.content };
      } else if (chunk.type === 'tool_call' && chunk.name === 'AskUserQuestion') {
        yield { type: 'ask_question', phaseId, question: chunk.input };
      }
    }
  }
}
```

### Spec Build Stage

```typescript
export class SpecBuildStage {
  constructor(
    private provider: AIProvider,
    private fs: FileSystem
  ) {}

  async execute(projectId: string, phaseId: string): Promise<PhaseArtifact> {
    const project = await this.projectRepo.findById(projectId);
    const discoveryMessages = await this.messageRepo.listByProjectAndStage(projectId, 'discovery');

    const prompt: Prompt = {
      system: SPEC_BUILD_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Based on this discovery conversation, generate a complete PRD and SPEC.\n\n${this.formatDiscoveryMessages(discoveryMessages)}`,
        },
      ],
      tools: [WriteTool, EditTool],
      model: 'claude-opus-4',
      maxTokens: 16000,
    };

    // Agent writes files
    for await (const chunk of this.provider.query(prompt)) {
      if (chunk.type === 'tool_call') {
        await this.handleToolCall(chunk);
      }
    }

    // Read generated artifacts
    const prdPath = `.wolfkrow/pipelines/${projectId}/PRD.md`;
    const specPath = `.wolfkrow/pipelines/${projectId}/SPEC.md`;

    return { prdPath, specPath };
  }
}
```

### Spec Validate Stage

```typescript
export class SpecValidateStage {
  constructor(private provider: AIProvider) {}

  async execute(projectId: string, phaseId: string): Promise<ValidationReport> {
    const specPath = `.wolfkrow/pipelines/${projectId}/SPEC.md`;
    const spec = await this.fs.readFile(specPath);

    const prompt: Prompt = {
      system: SPEC_VALIDATE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Review this SPEC for technical soundness, completeness, and risks.\n\n${spec}`,
        },
      ],
      tools: [ReadTool],
      model: 'claude-opus-4',
      maxTokens: 16000,
    };

    // ... stream validation report
  }
}
```

### Approval Stage

```typescript
export class ApprovalStage {
  async waitForUserDecision(projectId: string, phaseId: string): Promise<UserDecision> {
    // This blocks until user clicks Approve/Reject/Edit
    return new Promise((resolve) => {
      this.decisionEmitter.once(`project:${projectId}:decision`, resolve);
    });
  }
}

// IPC: user clicks button
export async function approvePipeline(projectId: string, notes: string) {
  this.decisionEmitter.emit(`project:${projectId}:decision`, { type: 'approve', notes });
}

export async function rejectPipeline(projectId: string, notes: string) {
  this.decisionEmitter.emit(`project:${projectId}:decision`, { type: 'reject', notes });
}
```

---

## 5. UI Components

### PipelinePage

```tsx
'use client';
export function PipelinePage() {
  const { data: projects } = usePipelineProjects();

  return (
    <div className="grid grid-cols-3 gap-4">
      <PipelineProjectList projects={projects} />
      {selectedProjectId && <PipelineChatView projectId={selectedProjectId} />}
      {selectedProjectId && <PipelineProgressBar projectId={selectedProjectId} />}
    </div>
  );
}
```

### PipelineChatView (per-stage chat)

```tsx
'use client';
export function PipelineChatView({ projectId }: { projectId: string }) {
  const { data: messages } = usePipelineMessages(projectId);
  const sendMessage = useSendPipelineMessage();

  return (
    <div>
      <StreamViewer messages={messages} />
      <ChatInput onSend={(content) => sendMessage({ projectId, content })} />
      <ApprovalButtons projectId={projectId} /> {/* Only shown in approval stage */}
    </div>
  );
}
```

### PipelineProgressBar

```tsx
'use client';
export function PipelineProgressBar({ projectId }: { projectId: string }) {
  const { data: project } = usePipelineProject(projectId);

  const stages = ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation'];
  const currentIndex = stages.indexOf(project?.currentStage);

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => (
        <div
          key={stage}
          className={cn(
            'flex items-center gap-2',
            i < currentIndex && 'text-green-500',
            i === currentIndex && 'font-bold text-blue-500',
            i > currentIndex && 'text-zinc-500'
          )}
        >
          {i < currentIndex ? (
            <Check />
          ) : i === currentIndex ? (
            <Loader className="animate-spin" />
          ) : (
            <Circle />
          )}
          <span className="capitalize">{stage.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Testes

- Discovery interview flow
- SPEC generation produces valid output
- SPEC validation detects issues
- Approval workflow (approve/reject/edit)
- Integration with Harness on approval
