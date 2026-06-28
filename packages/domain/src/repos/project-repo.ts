import type { Project } from '../entities/project';

export interface ProjectRepo {
  findAll(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  save(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
}
