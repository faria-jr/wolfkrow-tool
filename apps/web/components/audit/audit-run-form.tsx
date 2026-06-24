'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuditRunFormProps {
  onRun: (projectPath: string) => void;
  loading: boolean;
}

export function AuditRunForm({ onRun, loading }: AuditRunFormProps) {
  const [path, setPath] = useState('');

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (path.trim()) onRun(path.trim());
      }}
    >
      <div className="flex-1">
        <Label htmlFor="project-path">Project path</Label>
        <Input
          id="project-path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/path/to/project"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Running...' : 'Run audit'}
      </Button>
    </form>
  );
}
