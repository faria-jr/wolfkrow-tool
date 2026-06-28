'use client';

import { Palette, FolderGit, Loader2, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { BootstrappingView } from '@/components/sidecar/bootstrapping-view';
import { DesignStudio } from '@/components/sidecar/design-studio';
import { SessionConfigView } from '@/components/sidecar/session-config-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Project {
  id: string;
  name: string;
  description?: string;
  currentStage: string;
}

function LoadingView() {
  return (
    <PageShell>
      <PageHeader
        title="Design Studio"
        description="Loading workspace..."
        icon={<Palette className="h-6 w-6" />}
      />
      <PageContent className="text-muted-foreground flex h-64 items-center justify-center gap-2 font-mono text-xs">
        <Loader2 className="text-primary h-4 w-4 animate-spin" />
        <span>Loading projects...</span>
      </PageContent>
    </PageShell>
  );
}

function ProjectCard({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (project: Project) => void;
}) {
  return (
    <Card
      className="hover:bg-muted/30 cursor-pointer border border-zinc-800 bg-zinc-950 transition-all"
      onClick={() => onSelect(project)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-bold text-zinc-200">
          <FolderGit className="text-primary h-4 w-4" />
          {project.name}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-xs">
          {project.description || 'No description provided.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-400">
          Stage: {project.currentStage}
        </span>
      </CardContent>
    </Card>
  );
}

function ProjectSelectionView({
  projects,
  onSelect,
}: {
  projects: Project[];
  onSelect: (project: Project) => void;
}) {
  return (
    <PageShell>
      <PageHeader
        title="Design Studio"
        description="Select a project to start editing"
        icon={<Palette className="h-6 w-6" />}
      />
      <PageContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onSelect={onSelect} />
          ))}
          {projects.length === 0 && (
            <p className="text-muted-foreground col-span-full py-8 text-center text-xs">
              No pipeline projects registered. Register a project in the Pipeline screen to use
              Design Studio.
            </p>
          )}
        </div>
      </PageContent>
    </PageShell>
  );
}

function BackHeader({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-2 flex shrink-0 items-center justify-between border-b pb-2">
      <PageHeader title={title} description={description} icon={<Palette className="h-6 w-6" />} />
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
      </Button>
    </div>
  );
}

function usePipelineProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/pipeline/projects');
        if (res.ok) {
          setProjects(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void loadProjects();
  }, []);

  return { projects, loading };
}

export default function DesignPage() {
  const { projects, loading } = usePipelineProjects();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  if (loading) return <LoadingView />;

  if (!selectedProject) {
    return <ProjectSelectionView projects={projects} onSelect={setSelectedProject} />;
  }

  if (bootstrapping && !studioUrl) {
    return (
      <PageShell>
        <PageHeader
          title="Design Studio"
          description={`Bootstrapping: ${selectedProject.name}`}
          icon={<Palette className="h-6 w-6" />}
        />
        <PageContent className="overflow-hidden">
          <BootstrappingView stage="sidecar" />
        </PageContent>
      </PageShell>
    );
  }

  if (!studioUrl) {
    return (
      <PageShell>
        <BackHeader
          title="Design Studio"
          description={`Configure session for ${selectedProject.name}`}
          onBack={() => setSelectedProject(null)}
        />
        <PageContent className="mx-auto max-w-md py-8">
          <SessionConfigView
            wolfkrowProjectId={selectedProject.id}
            name={selectedProject.name}
            specContent="Design and refine dashboard pages"
            onStudioUrl={(url) => {
              setStudioUrl(url);
              setBootstrapping(false);
            }}
          />
        </PageContent>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <BackHeader
        title="Design Studio"
        description={`Open Design — visual editor for ${selectedProject.name}`}
        onBack={() => setStudioUrl(null)}
      />
      <PageContent className="flex flex-1 flex-col overflow-hidden">
        <DesignStudio overrideUrl={studioUrl} projectId={selectedProject.id} />
      </PageContent>
    </PageShell>
  );
}
