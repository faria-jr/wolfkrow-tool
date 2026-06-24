import type { McpServerVisibility } from '@wolfkrow/domain';
import { cookies } from 'next/headers';


import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

interface Params { params: Promise<{ id: string }>; }

const VALID_VISIBILITY: ReadonlyArray<McpServerVisibility> = ['always', 'on-demand', 'background'];

function isValidVisibility(value: unknown): value is McpServerVisibility {
  return typeof value === 'string' && VALID_VISIBILITY.includes(value as McpServerVisibility);
}

export async function PATCH(request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const repo = getRepos().mcpServer;
  const existing = repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  if (typeof body.isActive === 'boolean') {
    repo.toggleActive(id, body.isActive);
  }
  if ('visibility' in body) {
    if (!isValidVisibility(body.visibility)) {
      return Response.json(
        { error: `visibility must be one of ${VALID_VISIBILITY.join(', ')}` },
        { status: 422 },
      );
    }
    repo.setVisibility(id, body.visibility);
  }
  return Response.json({ server: repo.findById(id) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repo = getRepos().mcpServer;
  const existing = repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  repo.delete(id);
  return new Response(null, { status: 204 });
}
