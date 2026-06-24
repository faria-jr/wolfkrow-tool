import { randomUUID } from 'node:crypto';

import { CreateMcpServerRequestBodySchema } from '@wolfkrow/shared-types';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = getRepos().mcpServer;
  const servers = repo.findAll(session.userId);
  return Response.json({ servers });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(CreateMcpServerRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().mcpServer;
  const server = repo.save(randomUUID(), {
    userId: session.userId,
    name: body.name,
    ...(body.description !== undefined ? { description: body.description } : {}),
    command: body.command,
    args: body.args ?? [],
    env: body.env ?? {},
    isActive: body.isActive ?? false,
    isBuiltIn: false,
    visibility: 'always',
    ...(body.healthCheck !== undefined ? { healthCheck: body.healthCheck } : {}),
  });
  return Response.json({ server }, { status: 201 });
}
