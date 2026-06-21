/**
 * POST /api/agents/[id]/duplicate — duplicate agent with new name
 */

import { NotFoundError } from '@wolfkrow/domain';
import { DrizzleAgentRepo } from '@wolfkrow/infra';
import { DuplicateAgentUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

interface Ctx { params: Promise<{ id: string }>; }

export async function POST(request: Request, ctx: Ctx) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { newName?: string } | null;
  const newName = body?.newName?.trim();
  if (!newName) return Response.json({ error: 'newName is required' }, { status: 400 });

  try {
    const { agent } = await new DuplicateAgentUseCase(new DrizzleAgentRepo()).execute({ id, userId: session.userId, newName });
    return Response.json({ agent: agent.toProps() }, { status: 201 });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
