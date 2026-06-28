import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { workerFetch } from '@/lib/worker-fetch';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repo = getRepos().mcpServer;
  const server = repo.findById(id);
  if (!server || server.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const res = await workerFetch(`/mcp/servers/${encodeURIComponent(server.name)}/restart`, {
    method: 'POST',
    bearerToken: sessionCookie,
  });
  return Response.json(res.body, { status: res.status });
}
