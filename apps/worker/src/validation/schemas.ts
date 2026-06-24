/**
 * H.2 — Runtime Zod schemas for worker route handlers.
 *
 * Only schemas that are actually imported by route handlers live here. Dead
 * exports were removed in P1-1b (each removal was grep-verified against the
 * worker source tree). Other routes define their schemas locally next to the
 * handler (e.g. tasks.ts, usage.ts).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Graph ingest — S.5 (imported by routes/graph.ts)
// ---------------------------------------------------------------------------

export const graphIngestBody = z.object({
  text: z.string().min(1).max(500_000),
  sourceId: z.string().max(256).optional(),
  sourceLabel: z.string().max(256).optional(),
});

export const neighborhoodQuery = z.object({
  depth: z.coerce.number().int().min(1).max(3).default(1),
});

// ---------------------------------------------------------------------------
// Tasks — S.4 (task query filters; retained for shared use)
// ---------------------------------------------------------------------------

export const taskQuery = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
  category: z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']).optional(),
});

// ---------------------------------------------------------------------------
// Usage — S.2 (query filters; retained for shared use)
// ---------------------------------------------------------------------------

export const usageQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  model: z.string().optional(),
  source: z.string().optional(),
  agentId: z.string().optional(),
});
