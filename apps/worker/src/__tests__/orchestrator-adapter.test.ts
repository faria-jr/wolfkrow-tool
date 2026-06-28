/**
 * Tests: T23 — OrchestratorChatAdapter must use the shared DEFAULT_AGENT_MODEL
 * constant, not a hardcoded deprecated literal.
 */

import { DEFAULT_AGENT_MODEL } from '@wolfkrow/shared-types';
import { describe, expect, it, vi } from 'vitest';

import type { OrchestratorService } from '../orchestrator';
import { OrchestratorChatAdapter } from '../telegram/orchestrator-adapter';

describe('OrchestratorChatAdapter', () => {
  it('streams using DEFAULT_AGENT_MODEL (no hardcoded literal)', async () => {
    const stream = vi.fn(async function* (_input: { model?: string }) {
      yield { delta: 'hi' };
    });

    const orchestrator = { stream } as unknown as OrchestratorService;
    const adapter = new OrchestratorChatAdapter(orchestrator);

    await adapter.chat('user-1', 'hello');

    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream.mock.calls[0]?.[0]?.model).toBe(DEFAULT_AGENT_MODEL);
  });
});
