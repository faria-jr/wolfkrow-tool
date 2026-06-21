import { DrizzleDailySummaryRepo } from '@wolfkrow/infra';
import { GenerateDailySummaryUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = new DrizzleDailySummaryRepo();
  const summaries = await repo.findByUserId(session.userId);
  return Response.json({ summaries: summaries.map((s) => s.toProps()) });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { date?: string; content?: string };
  const date = body.date ?? new Date().toISOString().slice(0, 10);

  const repo = new DrizzleDailySummaryRepo();
  const uc = new GenerateDailySummaryUseCase(repo);
  const result = await uc.execute({
    userId: session.userId,
    date,
    content: body.content ?? `Manual summary for ${date}`,
    sessionCount: 0,
    messageCount: 0,
    tokensUsed: 0,
    cost: 0,
  });

  return Response.json({ summary: result.summary.toProps() }, { status: 201 });
}
