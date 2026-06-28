# SPEC-005: Harness System

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P1 (importante)
**Owner**: TBD

---

## 1. Visão Geral

Sistema automatizado de code implementation com loop Planner→Coder→Evaluator. Recebe SPEC.md como input, decompõe em sprints, implementa cada feature, valida contra acceptance criteria.

### Agentes

- **Planner** (opus, max effort): decompõe SPEC em sprints + features + acceptance criteria
- **Coder** (sonnet, high effort): implementa features usando tools
- **Evaluator**: valida contra acceptance criteria, fornece feedback

### Fluxo

```
SPEC.md → Planner → Sprints + Features + Criteria
                  ↓
For each sprint:
  For each feature:
    Loop (max 5 rounds):
      Coder implements → writes code
      Evaluator validates → feedback
      If passed → next feature
      If failed → feedback to Coder
  If sprint complete → next sprint
```

---

## 2. Database Schema

```typescript
export const harnessProjects = sqliteTable('harness_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  specPath: text('spec_path').notNull(),
  status: text('status', {
    enum: ['planning', 'ready', 'running', 'paused', 'completed', 'failed', 'cancelled'],
  }).notNull(),
  config: text('config', { mode: 'json' }).$type<HarnessConfig>().default({}),
  metrics: text('metrics', { mode: 'json' }).$type<ProjectMetrics>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const harnessSprints = sqliteTable('harness_sprints', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => harnessProjects.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  metrics: text('metrics', { mode: 'json' }).$type<SprintMetrics>().default({}),
});

export const harnessRounds = sqliteTable('harness_rounds', {
  id: text('id').primaryKey(),
  sprintId: text('sprint_id')
    .notNull()
    .references(() => harnessSprints.id, { onDelete: 'cascade' }),
  featureIndex: integer('feature_index').notNull(),
  roundNumber: integer('round_number').notNull(),
  status: text('status', {
    enum: ['coder_running', 'evaluator_running', 'passed', 'failed', 'max_rounds_reached'],
  }).notNull(),
  coderMessages: text('coder_messages', { mode: 'json' }).$type<Message[]>().default([]),
  evaluatorFeedback: text('evaluator_feedback'),
  metrics: text('metrics', { mode: 'json' }).$type<RoundMetrics>().default({}),
  startedAt: integer('started_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
```

---

## 3. Planner Agent

````typescript
// apps/worker/src/harness/planner.ts
export class HarnessPlanner {
  constructor(
    private provider: AIProvider,
    private projectRepo: HarnessProjectRepo,
    private sprintRepo: HarnessSprintRepo
  ) {}

  async plan(projectId: string, specContent: string): Promise<HarnessSprint[]> {
    const prompt = this.buildPlannerPrompt(specContent);

    let response = '';
    for await (const chunk of this.provider.query(prompt, {
      signal: new AbortController().signal,
    })) {
      if (chunk.type === 'text') response += chunk.content;
    }

    // Parse JSON response (Planner returns structured sprints)
    const sprintsData = this.parsePlannerResponse(response);

    // Persist sprints
    const sprints = await Promise.all(
      sprintsData.map((data, i) =>
        this.sprintRepo.create({
          projectId,
          number: i + 1,
          name: data.name,
          description: data.description,
          status: 'pending',
          config: { features: data.features },
        })
      )
    );

    return sprints;
  }

  private buildPlannerPrompt(spec: string): Prompt {
    return {
      system: PLANNER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Decompose the following SPEC into sprints with features and acceptance criteria.\n\n${spec}`,
        },
      ],
      tools: [],
      model: 'claude-opus-4',
      maxTokens: 16000,
    };
  }

  private parsePlannerResponse(response: string): PlannerSprintData[] {
    // Extract JSON block from response
    const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/);
    if (!jsonMatch) throw new Error('Planner did not return JSON');

    return JSON.parse(jsonMatch[1]);
  }
}
````

---

## 4. Coder + Evaluator Loop

```typescript
// apps/worker/src/harness/engine.ts
export class HarnessEngine {
  constructor(
    private planner: HarnessPlanner,
    private coder: CoderAgent,
    private evaluator: EvaluatorAgent,
    private projectRepo: HarnessProjectRepo,
    private sprintRepo: HarnessSprintRepo,
    private roundRepo: HarnessRoundRepo,
    private events: EventBus,
  ) {}

  async run(projectId: string): AsyncIterable<HarnessEvent> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) throw new HarnessProjectNotFoundError(projectId);

    // Phase 1: Plan
    yield { type: 'phase', phase: 'planning' };
    const spec = await fs.readFile(project.specPath, 'utf-8');
    const sprints = await this.planner.plan(projectId, spec);
    yield { type: 'sprints_planned', sprints };

    await this.projectRepo.update(projectId, { status: 'ready' });

    // Phase 2: Execute
    for (const sprint of sprints) {
      yield { type: 'sprint_started', sprint };

      for (let i = 0; i < sprint.config.features.length; i++) {
        const feature = sprint.config.features[i];

        // Loop until passed or max rounds
        let passed = false;
        for (let round = 1; round <= project.config.maxRoundsPerFeature; round++) {
          yield { type: 'round_started', sprint, feature, round };

          const roundRecord = await this.roundRepo.create({
            sprintId: sprint.id,
            featureIndex: i,
            roundNumber: round,
            status: 'coder_running',
          });

          // Coder runs
          const coderResult = await this.coder.implement({
            project,
            sprint,
            feature,
            previousFeedback: round > 1 ? (await this.roundRepo.findById(roundRecord.id))?.evaluatorFeedback : undefined,
          });

          // Evaluator runs
          await this.roundRepo.update(roundRecord.id, { status: 'evaluator_running' });

          const evalResult = await this.evaluator.evaluate({
            project,
            sprint,
            feature,
            coderOutput: coderResult,
          });

          if (evalResult.passed) {
            await this.roundRepo.update(roundRecord.id, {
              status: 'passed',
              evaluatorFeedback: evalResult.feedback,
              completedAt: new Date(),
            });
            passed = true;
            yield { type: 'round_passed', round: roundRecord };
            break;
          } else {
            await this.roundRepo.update(roundRecord.id, {
              status: 'failed',
              evaluatorFeedback: evalResult.feedback,
              completedAt: new Date(),
            });
            yield { type: 'round_failed', round: roundRecord, feedback: evalResult.feedback };
          }
        }

        if (!passed) {
          yield { type: 'feature_failed', feature, reason: 'max_rounds_reached' };
          // Continue to next feature or abort?
        }
      }

      await this.sprintRepo.update(sprint.id, { status: 'completed', completedAt: new Date() });
      yield { type: 'sprint_completed', sprint };
    }

    await this.projectRepo.update(projectId, { status: 'completed', completedAt: new Date() });
    yield { type: 'project_completed', projectId };
  }
}
```

---

## 5. UI Components

### ExecutionView

```tsx
'use client';
export function ExecutionView({ projectId }: { projectId: string }) {
  const { data: project } = useHarnessProject(projectId);
  const { data: sprints } = useHarnessSprints(projectId);
  const { data: rounds } = useHarnessRounds(projectId);

  return (
    <div className="grid grid-cols-3 gap-4">
      <SprintList sprints={sprints} />
      <ExecutionStream projectId={projectId} />
      <MetricsView metrics={project?.metrics} />
    </div>
  );
}
```

### AgentStreamPanel

```tsx
'use client';
export function AgentStreamPanel({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const es = new EventSource(`/api/harness/${projectId}/stream`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === 'message') {
        setMessages((prev) => [...prev, event.message]);
      }
    };

    return () => es.close();
  }, [projectId]);

  return (
    <div className="space-y-2">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}
    </div>
  );
}
```

### MetricsView

```tsx
'use client';
export function MetricsView({ metrics }: { metrics: ProjectMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Metric label="Total Tokens" value={metrics.totalTokens.toLocaleString()} />
        <Metric label="Total Cost" value={`$${metrics.totalCost.toFixed(4)}`} />
        <Metric label="Rounds" value={metrics.roundCount} />
        <Metric
          label="Features Passed"
          value={`${metrics.featuresPassed}/${metrics.featuresTotal}`}
        />
        <Metric label="Duration" value={formatDuration(metrics.totalDurationMs)} />
      </CardContent>
    </Card>
  );
}
```

---

## 6. Testes

### Unit

- Planner response parsing
- Coder tool usage
- Evaluator criteria checking
- Round loop logic

### Integration

- Full project: plan → sprints → rounds → complete
- Max rounds reached handling
- Pause/resume
- Manual abort

### E2E

- User creates project with SPEC
- Watches live execution
- Pauses mid-execution
- Reviews final diff
