import type { McpServerVisibility } from '@wolfkrow/domain';
import { UpdateMcpServerRequestBodySchema } from '@wolfkrow/shared-types';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

interface Params { params: Promise<{ id: string }>; }

const VALID_VISIBILITY: ReadonlyArray<McpServerVisibility> = ['always', 'on-demand', 'background'];

function isValidVisibility(value: unknown): value is McpServerVisibility {
  return typeof value === 'string' && VALID_VISIBILITY.includes(value as McpServerVisibility);
}

function hasCustomEditableFields(body: Record<string, unknown>): boolean {
  return ['name', 'description', 'command', 'args', 'env', 'healthCheck'].some((key) => key in body);
}

function optionalField<T>(value: T | undefined, current: T | undefined): T | undefined {
  return value !== undefined ? value : current;
}

function applyActiveToggle(repo: ReturnType<typeof getRepos>['mcpServer'], id: string, body: Record<string, unknown>): void {
  if (body.isActive !== undefined) {
    repo.toggleActive(id, body.isActive as boolean);
  }
}

function applyVisibilityChange(
  repo: ReturnType<typeof getRepos>['mcpServer'],
  id: string,
  body: Record<string, unknown>,
): Response | null {
  if (body.visibility === undefined) return null;
  if (!isValidVisibility(body.visibility)) {
    return Response.json(
      { error: `visibility must be one of ${VALID_VISIBILITY.join(', ')}` },
      { status: 422 },
    );
  }
  repo.setVisibility(id, body.visibility);
  return null;
}

function applyCustomFieldsSave(
  repo: ReturnType<typeof getRepos>['mcpServer'],
  id: string,
  body: Record<string, unknown>,
  existing: NonNullable<ReturnType<typeof repo.findById>>,
): void {
  const current = repo.findById(id) ?? existing;
  repo.save(id, {
    userId: current.userId,
    name: (body.name as string | undefined) ?? current.name,
    description: optionalField(body.description as string | undefined, current.description),
    command: (body.command as string | undefined) ?? current.command,
    args: (body.args as string[] | undefined) ?? current.args,
    env: (body.env as Record<string, string> | undefined) ?? current.env,
    isActive: (body.isActive as boolean | undefined) ?? current.isActive,
    isBuiltIn: current.isBuiltIn,
    visibility: isValidVisibility(body.visibility) ? body.visibility : current.visibility,
    healthCheck: optionalField(body.healthCheck as Record<string, unknown> | undefined, current.healthCheck),
  });
}

function applyNonBuiltInCustomSave(
  repo: ReturnType<typeof getRepos>['mcpServer'],
  id: string,
  body: Record<string, unknown>,
  existing: NonNullable<ReturnType<typeof repo.findById>>,
): void {
  if (!existing.isBuiltIn && hasCustomEditableFields(body)) {
    applyCustomFieldsSave(repo, id, body, existing);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = validateBody(UpdateMcpServerRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().mcpServer;
  const existing = repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.isBuiltIn && hasCustomEditableFields(body)) {
    return Response.json({ error: 'Built-in servers only allow active and visibility changes' }, { status: 422 });
  }

  applyActiveToggle(repo, id, body);

  const visibilityError = applyVisibilityChange(repo, id, body);
  if (visibilityError) return visibilityError;

  applyNonBuiltInCustomSave(repo, id, body, existing);
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
