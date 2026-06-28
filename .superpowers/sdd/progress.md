# SDD Progress Ledger — feat/mvp-glm-f1-f2

Base commit: dad1b77
Branch: worktree-feat+mvp-glm-f1-f2
Plan: docs/mvp_final_plan_glm.md (F1 + F2)

## Tasks

- [x] Task 1 (F1.4): Auth sidecar routes — add `preHandler: [server.authenticate]` to sidecar routes
- [x] Task 2 (F1.6): Clean up broken sidecar legacy — remove apps/sidecar
- [x] Task 3 (F1.5): Fix "erro ao criar projeto" — validateSpecPath in harness create route
- [x] Task 4 (F1.3): Pipeline/enrich respect selected provider — resolveAIProvider in enrich.ts
- [x] Task 5 (F1.2): Fix 401 in worker proxies — standardize Authorization Bearer in 13 routes
- [x] Task 6 (F1.1): Fix chat 401 + SSE error — /api/chat/send proxy + sse.ts error fix
- [x] Task 7 (F2.7): Remove double padding — harness-view.tsx + pipeline-view.tsx
- [x] Task 8 (F2.5): Deep-link ActiveRunsBar — href to /harness/:id/run + /pipeline/:id/run
- [x] Task 9 (F2.2): Execute opens live monitoring — autoplay=1 query param + auto-start
- [x] Task 10 (F2.3): Pass projectPath pipeline→harness — implement-via-harness.ts + tests
- [x] Task 11 (F2.6): Polished timeline in pipeline listing — PipelineStageProgress vertical
- [x] Task 12 (F2.4): Add MetricsChart to harness — recharts AreaChart for tokens per round
- [x] Task 13 (F2.1): HITL real chat in harness — server-side message from feedbackHandler
- [x] Task 14 (F2.8): Integrate /projects as central registry — project picker in forms

## Completed

Task 1 (F1.4): complete (commits dad1b77..56c2592, 7/7 tests, review clean)
Task 2 (F1.6): complete (commit 2cea220, review clean)
Task 7 (F2.7): complete (commit aa1121b, review clean)
Task 8 (F2.5): complete (commit 4e957fe, review clean)
Task 9 (F2.2): complete (commit 5fe3ceb, review clean)
Task 4 (F1.3): complete (commit 8df221a, 14/14 tests, review clean)
Task 5 (F1.2): complete (commit ce5dee8, review clean)
Task 6 (F1.1): complete (commit 595d1ba, review clean)
Task 3 (F1.5) + Task 10 (F2.3): complete (commit df3df31, 7/7 + 15/15 tests, review clean)
Task 11 (F2.6): complete (commit fca454c, typecheck clean)
Task 12 (F2.4): complete (commit 5b62695, typecheck clean)
Task 13 (F2.1): complete (commit 407c1f7, 15/15 tests, typecheck clean)
Task 14 (F2.8): complete (commit 57b9208, typecheck clean)

ALL TASKS COMPLETE — 606 worker tests passing, 0 typecheck errors in core packages
