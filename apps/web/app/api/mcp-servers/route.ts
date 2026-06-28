import { randomUUID } from 'node:crypto';

import type { McpServerRecord } from '@wolfkrow/domain';
import { BUILT_IN_MCP_SERVERS } from '@wolfkrow/infra';
import { CreateMcpServerRequestBodySchema } from '@wolfkrow/shared-types';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

function virtualBuiltInId(name: string): string {
  return `built-in:${name}`;
}

function builtInVirtualRecord(entry: (typeof BUILT_IN_MCP_SERVERS)[number]): McpServerRecord {
  const now = new Date();
  return {
    id: virtualBuiltInId(entry.name),
    userId: null,
    name: entry.name,
    description: entry.description,
    command: entry.command,
    args: entry.args,
    env: {},
    isActive: false,
    isBuiltIn: true,
    visibility: entry.visibility,
    healthCheck: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function withVirtualBuiltIns(servers: McpServerRecord[]): McpServerRecord[] {
  const existingNames = new Set(servers.map((server) => server.name));
  const virtual = BUILT_IN_MCP_SERVERS.filter((entry) => !existingNames.has(entry.name)).map(
    (entry) => builtInVirtualRecord(entry)
  );
  return [...servers, ...virtual];
}

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = getRepos().mcpServer;
  const servers = withVirtualBuiltIns(repo.findAll(session.userId));
  return Response.json({ servers });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(
    CreateMcpServerRequestBodySchema,
    await request.json().catch(() => null)
  );
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
