/**
 * POST /api/agents/sync — SyncAgentsToOrchestratorUseCase: alinha runtime/model em batch.
 */

import type { Runtime } from '@wolfkrow/domain';
import { SyncAgentsToOrchestratorUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

interface SyncBody {
  targetRuntime: Runtime;
  targetModel: string | undefined;
}

const VALID_RUNTIMES = new Set<Runtime>(['cloud', 'local', 'codex', 'external']);

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SyncBody | null;
  if (!body?.targetRuntime || !VALID_RUNTIMES.has(body.targetRuntime)) {
    return Response.json({ error: 'Valid targetRuntime required' }, { status: 400 });
  }

  const out = await new SyncAgentsToOrchestratorUseCase(getRepos().agent).execute({
    userId: session.userId,
    targetRuntime: body.targetRuntime,
    targetModel: body.targetModel,
  });

  return Response.json({ synced: out.synced });
}
