import { randomUUID } from 'node:crypto';

/**
 * Central `Project` entity.
 *
 * A single project registration shared by Harness, Pipeline, OpenDesign,
 * Knowledge and Terminal so that `projectPath` / `specPath` and default
 * provider/model config live in one place instead of being duplicated across
 * per-workflow project tables.
 *
 * `userId` is the actor that created the record for audit; in shared-workspace
 * mode every authenticated actor can read/update it (no per-user filtering).
 */

export type ProjectStatus = 'active' | 'archived';

export interface ProjectProps {
  id: string;
  userId: string;
  name: string;
  description: string | undefined;
  /** Absolute path of the repository the project works in. */
  rootPath: string | undefined;
  /** Optional absolute path to a spec/prd document. */
  specPath: string | undefined;
  /** Default provider id used when a workflow does not override it. */
  defaultProviderId: string | undefined;
  defaultPlannerModel: string | undefined;
  defaultCoderModel: string | undefined;
  tags: readonly string[];
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectCreateInput = Pick<ProjectProps, 'userId' | 'name'> &
  Partial<
    Pick<
      ProjectProps,
      | 'description'
      | 'rootPath'
      | 'specPath'
      | 'defaultProviderId'
      | 'defaultPlannerModel'
      | 'defaultCoderModel'
      | 'tags'
    >
  >;

export type ProjectUpdateInput = Partial<
  Pick<
    ProjectProps,
    | 'name'
    | 'description'
    | 'rootPath'
    | 'specPath'
    | 'defaultProviderId'
    | 'defaultPlannerModel'
    | 'defaultCoderModel'
    | 'tags'
    | 'status'
  >
>;

export class Project {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly rootPath: string | undefined;
  readonly specPath: string | undefined;
  readonly defaultProviderId: string | undefined;
  readonly defaultPlannerModel: string | undefined;
  readonly defaultCoderModel: string | undefined;
  readonly tags: readonly string[];
  readonly status: ProjectStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProjectProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.rootPath = props.rootPath;
    this.specPath = props.specPath;
    this.defaultProviderId = props.defaultProviderId;
    this.defaultPlannerModel = props.defaultPlannerModel;
    this.defaultCoderModel = props.defaultCoderModel;
    this.tags = props.tags;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: ProjectCreateInput): Project {
    const now = new Date();
    return new Project({
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      description: input.description,
      rootPath: input.rootPath,
      specPath: input.specPath,
      defaultProviderId: input.defaultProviderId,
      defaultPlannerModel: input.defaultPlannerModel,
      defaultCoderModel: input.defaultCoderModel,
      tags: input.tags ? [...input.tags] : [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: ProjectProps): Project {
    return new Project(props);
  }

  toProps(): ProjectProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      rootPath: this.rootPath,
      specPath: this.specPath,
      defaultProviderId: this.defaultProviderId,
      defaultPlannerModel: this.defaultPlannerModel,
      defaultCoderModel: this.defaultCoderModel,
      tags: this.tags,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Returns a new Project with the given fields merged in. */
  with(update: ProjectUpdateInput): Project {
    return Project.fromProps({
      ...this.toProps(),
      ...stripUndefined(update),
      tags: update.tags !== undefined ? [...update.tags] : this.tags,
      updatedAt: new Date(),
    });
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}
