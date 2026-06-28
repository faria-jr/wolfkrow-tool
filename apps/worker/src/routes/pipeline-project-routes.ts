import type { PipelineProjectRepo } from '@wolfkrow/domain';
import {
  CreatePipelineProjectUseCase,
  DeletePipelineProjectUseCase,
  GetPipelineProjectUseCase,
  ListPipelineProjectsUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../config';
import { validateProjectPath } from '../lib/project-path';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

type AuthHooks = {
  onRequest: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>>;
};

const createProjectBody = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(8192).optional(),
  projectPath: z.string().max(4096).optional(),
});

const uid = (req: FastifyRequest) => (req as unknown as { user: { userId: string } }).user.userId;
const sharedWorkspace = () => config.WOLFKROW_SHARED_WORKSPACE !== 'false';

async function handleCreate(
  projectRepo: PipelineProjectRepo,
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = validate(createProjectBody, req.body);
  let projectPath: string | undefined;
  if (body.projectPath !== undefined) {
    const checked = validateProjectPath(body.projectPath);
    if (!checked.ok) return reply.status(422).send({ error: checked.reason });
    projectPath = checked.path;
  }

  const { project } = await new CreatePipelineProjectUseCase(projectRepo).execute(uid(req), {
    name: body.name,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(projectPath !== undefined ? { projectPath } : {}),
  });
  return project.toProps();
}

async function handleList(projectRepo: PipelineProjectRepo, req: FastifyRequest) {
  const projects = sharedWorkspace()
    ? await projectRepo.findAll()
    : (await new ListPipelineProjectsUseCase(projectRepo).execute({ userId: uid(req) })).projects;
  return projects.map((p) => p.toProps());
}

async function handleGet(
  projectRepo: PipelineProjectRepo,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { project } = await new GetPipelineProjectUseCase(projectRepo).execute({
      projectId: req.params.id,
    });
    return project.toProps();
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

async function handleDelete(
  projectRepo: PipelineProjectRepo,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    if (sharedWorkspace()) {
      const project = await projectRepo.findById(req.params.id);
      if (!project) return reply.status(404).send({ error: 'Not found' });
      await projectRepo.delete(req.params.id);
    } else {
      await new DeletePipelineProjectUseCase(projectRepo).execute({
        projectId: req.params.id,
        userId: uid(req),
      });
    }
    return reply.status(204).send();
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

export function registerPipelineProjectRoutes(
  server: AuthFastifyInstance,
  projectRepo: PipelineProjectRepo,
  auth: AuthHooks
): void {
  server.post('/projects', auth, async (req, reply) => handleCreate(projectRepo, req, reply));
  server.get('/projects', auth, async (req) => handleList(projectRepo, req));
  server.get<{ Params: { id: string } }>('/projects/:id', auth, async (req, reply) =>
    handleGet(projectRepo, req, reply)
  );
  server.delete<{ Params: { id: string } }>('/projects/:id', auth, async (req, reply) =>
    handleDelete(projectRepo, req, reply)
  );
}
