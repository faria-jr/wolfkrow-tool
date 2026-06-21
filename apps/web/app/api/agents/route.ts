/**
 * GET  /api/agents — list agents for authenticated user
 * POST /api/agents — create new agent
 */

import type { Agent } from '@wolfkrow/domain';
import { DrizzleAgentRepo } from '@wolfkrow/infra';
import { CreateAgentUseCase, ListAgentsUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { parseCreateInput } from './parse';

import { getSession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { agents } = await new ListAgentsUseCase(new DrizzleAgentRepo()).execute({ userId: session.userId });
  return Response.json({ agents: agents.map((a: Agent) => a.toProps()) });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const { agent } = await new CreateAgentUseCase(new DrizzleAgentRepo()).execute(parseCreateInput(session.userId, body));
  return Response.json({ agent: agent.toProps() }, { status: 201 });
}
