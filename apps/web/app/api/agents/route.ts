/**
 * GET  /api/agents — list agents for authenticated user
 * POST /api/agents — create new agent
 */

import type { Agent } from '@wolfkrow/domain';
import { CreateAgentRequestBodySchema } from '@wolfkrow/shared-types';
import { CreateAgentUseCase, ListAgentsUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { parseCreateInput } from './parse';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { agents } = await new ListAgentsUseCase(getRepos().agent).execute({
    userId: session.userId,
  });
  return Response.json({ agents: agents.map((a: Agent) => a.toProps()) });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(CreateAgentRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const { agent } = await new CreateAgentUseCase(getRepos().agent).execute(
    parseCreateInput(session.userId, body)
  );
  return Response.json({ agent: agent.toProps() }, { status: 201 });
}
