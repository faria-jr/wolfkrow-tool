'use client';

import { FolderSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileResult {
  root: string;
  languages: string[];
  frameworks: string[];
  roles: Record<string, string[]>;
  fileCount: number;
  summary: string;
}

function ProfileForm({
  dir,
  loading,
  onChange,
  onSubmit,
}: {
  dir: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-card flex gap-2 rounded-lg border p-4">
      <Input
        placeholder="/absolute/path/to/repo"
        value={dir}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        className="flex-1"
        aria-label="Repository directory"
      />
      <Button onClick={onSubmit} disabled={loading || !dir.trim()}>
        {loading ? 'Profiling…' : 'Profile'}
      </Button>
    </div>
  );
}

function ProfileLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-2/3" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function BadgeList({
  items,
  variant,
  emptyLabel,
}: {
  items: string[];
  variant: 'secondary' | 'outline';
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

function RoleList({ roles }: { roles: Record<string, string[]> }) {
  const roleKeys = Object.keys(roles);
  if (roleKeys.length === 0) {
    return <p className="text-xs text-muted-foreground">No roles classified.</p>;
  }
  return (
    <Accordion type="multiple" className="rounded-lg border">
      {roleKeys.map((role) => (
        <AccordionItem key={role} value={role}>
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              {role}
              <Badge variant="secondary">{roles[role]?.length ?? 0}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1">
              {(roles[role] ?? []).map((file) => (
                <li key={file} className="font-mono text-xs text-muted-foreground">
                  {file}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ProfileResultCard({ result }: { result: ProfileResult }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{result.summary}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{result.fileCount}</span> files scanned ·
          root <span className="font-mono">{result.root}</span>
        </p>
      </div>

      <div className="space-y-2">
        <SectionHeading>Languages</SectionHeading>
        <BadgeList items={result.languages} variant="secondary" emptyLabel="None detected." />
      </div>

      <div className="space-y-2">
        <SectionHeading>Frameworks</SectionHeading>
        <BadgeList items={result.frameworks} variant="outline" emptyLabel="None detected." />
      </div>

      <div className="space-y-2">
        <SectionHeading>File roles</SectionHeading>
        <RoleList roles={result.roles} />
      </div>
    </div>
  );
}

async function fetchProfile(dir: string): Promise<ProfileResult> {
  const res = await fetch('/api/profiler', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as ProfileResult;
}

function ProfileBody({
  loading,
  error,
  result,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  result: ProfileResult | null;
  onRetry: () => void;
}) {
  if (loading) return <ProfileLoading />;
  if (error) {
    return (
      <ErrorState title="Profiler failed" description={error} retryLabel="Try again" onRetry={onRetry} />
    );
  }
  if (result) return <ProfileResultCard result={result} />;
  return (
    <EmptyState
      title="No profile yet"
      description="Enter an absolute repository path above and run Profile to detect languages, frameworks and file roles."
      icon={<FolderSearch className="h-6 w-6" />}
    />
  );
}

export function ProfilerView() {
  const [dir, setDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!dir.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchProfile(dir));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to profile repository';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const submit = () => void handleSubmit();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <ProfileForm dir={dir} loading={loading} onChange={setDir} onSubmit={submit} />
      <ProfileBody
        loading={loading}
        error={error}
        result={result}
        onRetry={submit}
      />
    </div>
  );
}
