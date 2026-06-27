'use client';

import { useEffect, useState } from 'react';
import { Palette, FolderGit, Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { DesignStudio } from '@/components/sidecar/design-studio';
import { SessionConfigView } from '@/components/sidecar/session-config-view';
import { BootstrappingView } from '@/components/sidecar/bootstrapping-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  description?: string;
  currentStage: string;
}

export default function DesignPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

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

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Design Studio" description="Loading workspace..." icon={<Palette className="h-6 w-6" />} />
        <PageContent className="flex items-center justify-center h-64 text-xs font-mono text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading projects...</span>
        </PageContent>
      </PageShell>
    );
  }

  // 1. Select Project Screen
  if (!selectedProject) {
    return (
      <PageShell>
        <PageHeader title="Design Studio" description="Select a project to start editing" icon={<Palette className="h-6 w-6" />} />
        <PageContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="hover:bg-muted/30 cursor-pointer transition-all border border-zinc-800 bg-zinc-950"
                onClick={() => setSelectedProject(p)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                    <FolderGit className="h-4 w-4 text-primary" />
                    {p.name}
                  </CardTitle>
                  <CardDescription className="text-[11px] line-clamp-2">{p.description || 'No description provided.'}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                    Stage: {p.currentStage}
                  </span>
                </CardContent>
              </Card>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full text-center py-8">
                No pipeline projects registered. Register a project in the Pipeline screen to use Design Studio.
              </p>
            )}
          </div>
        </PageContent>
      </PageShell>
    );
  }

  // 2. Bootstrapping view
  if (bootstrapping && !studioUrl) {
    return (
      <PageShell>
        <PageHeader title="Design Studio" description={`Bootstrapping: ${selectedProject.name}`} icon={<Palette className="h-6 w-6" />} />
        <PageContent className="overflow-hidden">
          <BootstrappingView
            status={{ installing: true, failed: false }}
            progress={{ step: 'Initializing environment...', percent: 45, detail: 'setting up open design local workspace' }}
            events={[]}
          />
        </PageContent>
      </PageShell>
    );
  }

  // 3. Configure session if no studioUrl
  if (!studioUrl) {
    return (
      <PageShell>
        <div className="flex items-center justify-between border-b pb-2 mb-2 shrink-0">
          <PageHeader title="Design Studio" description={`Configure session for ${selectedProject.name}`} icon={<Palette className="h-6 w-6" />} />
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} className="gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
          </Button>
        </div>
        <PageContent className="max-w-md mx-auto py-8">
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

  // 4. Render Studio View once we have studioUrl
  return (
    <PageShell>
      <div className="flex items-center justify-between border-b pb-2 mb-2 shrink-0">
        <PageHeader title="Design Studio" description={`Open Design — visual editor for ${selectedProject.name}`} icon={<Palette className="h-6 w-6" />} />
        <Button variant="ghost" size="sm" onClick={() => setStudioUrl(null)} className="gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to config
        </Button>
      </div>
      <PageContent className="overflow-hidden flex-1 flex flex-col">
        <DesignStudio overrideUrl={studioUrl} projectId={selectedProject.id} />
      </PageContent>
    </PageShell>
  );
}
