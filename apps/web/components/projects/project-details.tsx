import Link from 'next/link';

import { statusVariant, type ProjectData } from './project-types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="truncate font-mono text-xs">{value}</dd>
    </div>
  );
}

function DetailGrid({ project }: { project: ProjectData }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <Detail label="Repository root" value={project.rootPath ?? '—'} />
      <Detail label="Spec path" value={project.specPath ?? '—'} />
      <Detail label="Default provider" value={project.defaultProviderId ?? '—'} />
      <Detail label="Default planner model" value={project.defaultPlannerModel ?? '—'} />
      <Detail label="Default coder model" value={project.defaultCoderModel ?? '—'} />
      <Detail label="Tags" value={project.tags.length ? project.tags.join(', ') : '—'} />
    </dl>
  );
}

const WORKFLOW_LINKS: ReadonlyArray<{ label: string; href: (id: string) => string }> = [
  { label: 'Open in Chat', href: (id) => `/chat?project=${id}` },
  { label: 'Start Harness', href: (id) => `/harness?project=${id}` },
  { label: 'Start Pipeline', href: (id) => `/pipeline?project=${id}` },
];

function WorkflowLinks({ projectId }: { projectId: string }) {
  return (
    <div className="border-t pt-4">
      <h3 className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">Workflows</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        {WORKFLOW_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href(projectId)}
            className="rounded border px-3 py-1 hover:bg-muted"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export interface ProjectDetailsProps {
  project: ProjectData;
  onDelete: (id: string) => void;
  onArchiveToggle: (p: ProjectData) => void;
  error: string | null;
}

export function ProjectDetails({ project, onDelete, onArchiveToggle, error }: ProjectDetailsProps) {
  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{project.name}</h2>
          {project.description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{project.description}</p>
          )}
        </div>
        <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DetailGrid project={project} />

      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => onArchiveToggle(project)}>
          {project.status === 'archived' ? 'Restore' : 'Archive'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(project.id)}
        >
          Delete
        </Button>
      </div>

      <WorkflowLinks projectId={project.id} />
    </div>
  );
}
