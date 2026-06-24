/**
 * POST /api/agents/[id]/duplicate — duplicate agent with new name
 */

import { NotFoundError } from '@wolfkrow/domain';
import { DuplicateAgentRequestBodySchema } from '@wolfkrow/shared-types';
import { DuplicateAgentUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

interface Ctx { params: Promise<{ id: string }>; }

export async function POST(request: Request, ctx: Ctx) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = validateBody(DuplicateAgentRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;
  const newName = body.newName.trim();

  try {
    const { agent } = await new DuplicateAgentUseCase(getRepos().agent).execute({ id, userId: session.userId, newName });
    return Response.json({ agent: agent.toProps() }, { status: 201 });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
