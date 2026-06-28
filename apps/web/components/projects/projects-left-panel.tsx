import { statusVariant, type ProjectData } from './project-types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function ProjectListItem({
  project,
  selected,
  onSelect,
}: {
  project: ProjectData;
  selected: boolean;
  onSelect: (p: ProjectData) => void;
}) {
  return (
    <li
      className={`cursor-pointer rounded border p-3 text-sm ${selected ? 'border-info bg-info/10' : 'hover:bg-muted'}`}
      onClick={() => onSelect(project)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{project.name}</span>
        <Badge variant={statusVariant(project.status)} className="text-xs">
          {project.status}
        </Badge>
      </div>
      {project.rootPath && (
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{project.rootPath}</p>
      )}
    </li>
  );
}

export interface ProjectsLeftPanelProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  rootPath: string;
  setRootPath: (v: string) => void;
  creating: boolean;
  error: string | null;
  projects: ProjectData[];
  selected: ProjectData | null;
  onSubmit: (e: React.FormEvent) => void;
  onSelect: (p: ProjectData) => void;
}

function CreateProjectForm({
  name,
  setName,
  description,
  setDescription,
  rootPath,
  setRootPath,
  creating,
  onSubmit,
}: Pick<
  ProjectsLeftPanelProps,
  | 'name'
  | 'setName'
  | 'description'
  | 'setDescription'
  | 'rootPath'
  | 'setRootPath'
  | 'creating'
  | 'onSubmit'
>) {
  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded border p-3">
      <FormField id="project-name" label="Project name" value={name} onChange={setName} required />
      <div>
        <Label htmlFor="project-desc" className="text-muted-foreground mb-1 block text-xs">
          Description
        </Label>
        <Textarea
          id="project-desc"
          placeholder="Description (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <FormField
        id="project-root"
        label="Repository root path"
        placeholder="e.g. /Users/me/my-repo"
        value={rootPath}
        onChange={setRootPath}
      />
      <Button type="submit" disabled={creating} className="w-full">
        {creating ? 'Creating…' : 'New Project'}
      </Button>
    </form>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-muted-foreground mb-1 block text-xs">
        {label}
      </Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

export function ProjectsLeftPanel({
  name,
  setName,
  description,
  setDescription,
  rootPath,
  setRootPath,
  creating,
  error,
  projects,
  selected,
  onSubmit,
  onSelect,
}: ProjectsLeftPanelProps) {
  return (
    <div className="w-72 flex-shrink-0 space-y-4">
      <h2 className="text-lg font-semibold">Projects</h2>
      <CreateProjectForm
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        rootPath={rootPath}
        setRootPath={setRootPath}
        creating={creating}
        onSubmit={onSubmit}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <ProjectListItem
            key={p.id}
            project={p}
            selected={selected?.id === p.id}
            onSelect={onSelect}
          />
        ))}
        {projects.length === 0 && (
          <li className="text-muted-foreground p-3 text-sm">No projects yet.</li>
        )}
      </ul>
    </div>
  );
}
