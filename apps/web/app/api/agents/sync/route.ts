/**
 * POST /api/agents/sync — SyncAgentsToOrchestratorUseCase: alinha runtime/model em batch.
 */

import { AgentSyncRequestBodySchema } from '@wolfkrow/shared-types';
import { SyncAgentsToOrchestratorUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(AgentSyncRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const out = await new SyncAgentsToOrchestratorUseCase(getRepos().agent).execute({
    userId: session.userId,
    targetRuntime: body.targetRuntime,
    targetModel: body.targetModel,
  });

  return Response.json({ synced: out.synced });
}
