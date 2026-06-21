import { DrizzleMcpServerRepo } from '@wolfkrow/infra';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

interface Params { params: Promise<{ id: string }>; }

export async function PATCH(request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const repo = new DrizzleMcpServerRepo();
  const existing = repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  if (typeof body.isActive === 'boolean') {
    repo.toggleActive(id, body.isActive);
  }
  return Response.json({ server: repo.findById(id) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repo = new DrizzleMcpServerRepo();
  const existing = repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  repo.delete(id);
  return new Response(null, { status: 204 });
}
