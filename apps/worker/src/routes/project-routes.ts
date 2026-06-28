/**
 * Central Projects routes — CRUD for the shared project registration.
 *
 * POST   /projects        — create
 * GET    /projects        — list (workspace-scoped: shared workspace returns all)
 * GET    /projects/:id    — get one
 * PATCH  /projects/:id    — update
 * DELETE /projects/:id    — delete
 *
 * All routes require authentication. `rootPath` / `specPath` are validated
 * against the same allowlist the harness/pipeline coders use.
 */

import {
  CreateProjectUseCase,
  DeleteProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  UpdateProjectUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getRepos } from '../container';
import { validateProjectPath } from '../lib/project-path';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

const tagsSchema = z.array(z.string().min(1).max(255)).max(100).optional();

const createBody = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  rootPath: z.string().max(4096).optional(),
  specPath: z.string().max(4096).optional(),
  defaultProviderId: z.string().max(128).optional(),
  defaultPlannerModel: z.string().max(128).optional(),
  defaultCoderModel: z.string().max(128).optional(),
  tags: tagsSchema,
});

const updateBody = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional(),
  rootPath: z.string().max(4096).optional(),
  specPath: z.string().max(4096).optional(),
  defaultProviderId: z.string().max(128).optional(),
  defaultPlannerModel: z.string().max(128).optional(),
  defaultCoderModel: z.string().max(128).optional(),
  tags: tagsSchema,
  status: z.enum(['active', 'archived']).optional(),
});

type CreateInput = Parameters<CreateProjectUseCase['execute']>[1];
type UpdateInput = Parameters<UpdateProjectUseCase['execute']>[1];

type PathCheck = { ok: true; path: string | undefined } | { ok: false; reason: string };

function uid(req: FastifyRequest): string {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

/** Validates an optional path field, returning the resolved path or an error reason. */
function checkPath(raw: string | undefined): PathCheck {
  if (raw === undefined) return { ok: true, path: undefined };
  const checked = validateProjectPath(raw);
  return checked.ok ? { ok: true, path: checked.path } : { ok: false, reason: checked.reason };
}

function withOptional(out: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) out[key] = value;
}

function buildCreateInput(body: z.infer<typeof createBody>): CreateInput {
  const out: Record<string, unknown> = { name: body.name };
  withOptional(out, 'description', body.description);
  withOptional(out, 'rootPath', body.rootPath);
  withOptional(out, 'specPath', body.specPath);
  withOptional(out, 'defaultProviderId', body.defaultProviderId);
  withOptional(out, 'defaultPlannerModel', body.defaultPlannerModel);
  withOptional(out, 'defaultCoderModel', body.defaultCoderModel);
  withOptional(out, 'tags', body.tags);
  return out as CreateInput;
}

function buildUpdateInput(body: z.infer<typeof updateBody>): UpdateInput {
  const out: Record<string, unknown> = {};
  withOptional(out, 'name', body.name);
  withOptional(out, 'description', body.description);
  withOptional(out, 'rootPath', body.rootPath);
  withOptional(out, 'specPath', body.specPath);
  withOptional(out, 'defaultProviderId', body.defaultProviderId);
  withOptional(out, 'defaultPlannerModel', body.defaultPlannerModel);
  withOptional(out, 'defaultCoderModel', body.defaultCoderModel);
  withOptional(out, 'tags', body.tags);
  withOptional(out, 'status', body.status);
  return out as UpdateInput;
}

async function createHandler(req: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const repo = getRepos().project;
  const body = validate(createBody, req.body);
  const rootPath = checkPath(body.rootPath);
  if (!rootPath.ok) return reply.status(422).send({ error: rootPath.reason });
  const specPath = checkPath(body.specPath);
  if (!specPath.ok) return reply.status(422).send({ error: specPath.reason });

  const input = buildCreateInput({ ...body, rootPath: rootPath.path, specPath: specPath.path });
  const { project } = await new CreateProjectUseCase(repo).execute(uid(req), input);
  return reply.status(201).send(project.toProps());
}

async function listHandler(): Promise<unknown> {
  const { projects } = await new ListProjectsUseCase(getRepos().project).execute();
  return projects.map((p) => p.toProps());
}

async function getHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<unknown> {
  try {
    const { project } = await new GetProjectUseCase(getRepos().project).execute({
      projectId: req.params.id,
    });
    return project.toProps();
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

async function patchHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<unknown> {
  const body = validate(updateBody, req.body);
  const rootPath = checkPath(body.rootPath);
  if (!rootPath.ok) return reply.status(422).send({ error: rootPath.reason });
  const specPath = checkPath(body.specPath);
  if (!specPath.ok) return reply.status(422).send({ error: specPath.reason });

  const input = buildUpdateInput({ ...body, rootPath: rootPath.path, specPath: specPath.path });
  try {
    const { project } = await new UpdateProjectUseCase(getRepos().project).execute(
      req.params.id,
      input
    );
    return project.toProps();
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

async function deleteHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<unknown> {
  try {
    await new DeleteProjectUseCase(getRepos().project).execute({ projectId: req.params.id });
    return reply.status(204).send();
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

export async function projectRoutes(server: AuthFastifyInstance): Promise<void> {
  const auth = { onRequest: [server.authenticate] };
  server.post<{ Body: unknown }>('/projects', auth, createHandler);
  server.get('/projects', auth, listHandler);
  server.get<{ Params: { id: string } }>('/projects/:id', auth, getHandler);
  server.patch<{ Params: { id: string }; Body: unknown }>('/projects/:id', auth, patchHandler);
  server.delete<{ Params: { id: string } }>('/projects/:id', auth, deleteHandler);
}
