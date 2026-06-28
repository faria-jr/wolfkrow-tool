/**
 * Harness project CRUD handlers — create/list/get/delete.
 *
 * Extracted from harness.ts to keep the route module under the size limit.
 * Includes the F1.5 path-validation helper (specPath optional + actionable errors).
 */

import {
  CreateHarnessProjectUseCase,
  DeleteHarnessProjectUseCase,
  GetHarnessProjectUseCase,
  ListHarnessProjectsUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../config';
import { getRepos } from '../container';
import { validateProjectPath, validateSpecPath } from '../lib/project-path';
import { validate, z } from '../validation';

export const sharedWorkspace = () => config.WOLFKROW_SHARED_WORKSPACE !== 'false';

export function harnessRepos() {
  const r = getRepos();
  return {
    projectRepo: r.harnessProject,
    sprintRepo: r.harnessSprint,
    roundRepo: r.harnessRound,
  };
}

export const createProjectBody = z.object({
  name: z.string().min(1).max(256),
  specPath: z.string().max(4096).optional(),
  projectPath: z.string().max(4096).optional(),
  description: z.string().max(8192).optional(),
  maxRoundsPerFeature: z.number().int().min(1).max(50).optional(),
});

/** Validate harness project paths on create (F1.5). Returns ok:false with a
 *  400 reply already sent when a provided path is invalid. */
function validateCreatePaths(
  body: { specPath?: string; projectPath?: string },
  reply: FastifyReply
): { ok: true; specPath: string; projectPath: string | undefined } | { ok: false } {
  let specPath = '';
  if (body.specPath !== undefined && body.specPath.length > 0) {
    const checkedSpec = validateSpecPath(body.specPath);
    if (!checkedSpec.ok) {
      reply.status(400).send({
        error: `${checkedSpec.reason}. Provide an absolute path to a .md/.txt/.json spec file, or leave it blank to run from the project path.`,
      });
      return { ok: false };
    }
    specPath = checkedSpec.path;
  }
  let projectPath = body.projectPath;
  if (projectPath !== undefined) {
    const checked = validateProjectPath(projectPath);
    if (!checked.ok) {
      reply.status(400).send({
        error: `${checked.reason}. Provide an absolute path to the project repository.`,
      });
      return { ok: false };
    }
    projectPath = checked.path;
  }
  return { ok: true, specPath, projectPath };
}

export async function createProjectHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user?.userId ?? 'anonymous';
  const body = validate(createProjectBody, req.body);
  const paths = validateCreatePaths(
    {
      ...(body.specPath !== undefined ? { specPath: body.specPath } : {}),
      ...(body.projectPath !== undefined ? { projectPath: body.projectPath } : {}),
    },
    reply
  );
  if (!paths.ok) return;
  const { project } = await new CreateHarnessProjectUseCase(harnessRepos().projectRepo).execute({
    userId,
    name: body.name,
    specPath: paths.specPath,
    ...(paths.projectPath !== undefined ? { projectPath: paths.projectPath } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.maxRoundsPerFeature !== undefined
      ? { maxRoundsPerFeature: body.maxRoundsPerFeature }
      : {}),
  });
  return project.toProps();
}

export async function listHarnessProjectsHandler(req: FastifyRequest) {
  const userId = req.user?.userId ?? 'anonymous';
  const projectRepo = harnessRepos().projectRepo;
  const projects = sharedWorkspace()
    ? await projectRepo.findAll()
    : (await new ListHarnessProjectsUseCase(projectRepo).execute({ userId })).projects;
  return projects.map((p) => p.toProps());
}

export async function getHarnessProjectHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { project } = await new GetHarnessProjectUseCase(harnessRepos().projectRepo).execute({
      projectId: req.params.id,
    });
    return project.toProps();
  } catch {
    return reply.status(404).send({ error: 'Project not found' });
  }
}

export async function deleteHarnessProjectHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const projectRepo = harnessRepos().projectRepo;
    if (sharedWorkspace()) {
      const project = await projectRepo.findById(req.params.id);
      if (!project) return reply.status(404).send({ error: 'Project not found' });
      await projectRepo.delete(req.params.id);
    } else {
      const userId = req.user?.userId ?? 'anonymous';
      await new DeleteHarnessProjectUseCase(projectRepo).execute({
        projectId: req.params.id,
        userId,
      });
    }
    return reply.status(204).send();
  } catch {
    return reply.status(404).send({ error: 'Project not found' });
  }
}
