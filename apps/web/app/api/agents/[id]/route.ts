/**
 * PUT    /api/agents/[id] — update agent
 * DELETE /api/agents/[id] — delete agent
 */

import { NotFoundError } from '@wolfkrow/domain';
import { UpdateAgentInputSchema } from '@wolfkrow/shared-types';
import { DeleteAgentUseCase, UpdateAgentUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { parsePatchInput } from '../parse';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

interface Ctx { params: Promise<{ id: string }>; }

export async function PUT(request: Request, ctx: Ctx) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = validateBody(UpdateAgentInputSchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  try {
    const { agent } = await new UpdateAgentUseCase(getRepos().agent).execute({ id, userId: session.userId, patch: parsePatchInput(body) });
    return Response.json({ agent: agent.toProps() });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await new DeleteAgentUseCase(getRepos().agent).execute({ id, userId: session.userId });
    return Response.json({ deleted: true });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
