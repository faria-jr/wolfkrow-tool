import { randomUUID } from 'node:crypto';

import { DrizzleMcpServerRepo } from '@wolfkrow/infra';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = new DrizzleMcpServerRepo();
  const servers = repo.findAll(session.userId);
  return Response.json({ servers });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });
  if (!body.name || !body.command) return Response.json({ error: 'name and command required' }, { status: 422 });

  const repo = new DrizzleMcpServerRepo();
  const server = repo.save(randomUUID(), {
    userId: session.userId,
    name: String(body.name),
    ...(body.description !== undefined ? { description: String(body.description) } : {}),
    command: String(body.command),
    args: Array.isArray(body.args) ? (body.args as string[]) : [],
    env: (body.env as Record<string, string>) ?? {},
    isActive: Boolean(body.isActive),
    isBuiltIn: false,
    visibility: 'always',
    ...(body.healthCheck !== undefined ? { healthCheck: String(body.healthCheck) } : {}),
  });
  return Response.json({ server }, { status: 201 });
}
