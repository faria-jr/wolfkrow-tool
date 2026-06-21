import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const proxyForm = new FormData();
  const audio = form.get('audio');
  if (audio) proxyForm.append('audio', audio);

  const res = await fetch(`${WORKER}/voice/transcribe`, { method: 'POST', body: proxyForm });
  return Response.json(await res.json(), { status: res.status });
}
