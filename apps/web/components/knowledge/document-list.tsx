'use client';

import { FileText, Trash2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentProps {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error?: string;
  chunkCount: number;
  createdAt: Date | string;
}

interface Props {
  documents: DocumentProps[];
  onDeleted: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  ready: 'bg-success/15 text-success',
  processing: 'bg-warning/15 text-warning',
  pending: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/15 text-destructive',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ documents, onDeleted }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/knowledge/documents/${id}`, { method: 'DELETE', credentials: 'include' });
    setDeleting(null);
    onDeleted();
  };

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No documents yet. Upload some files above.</p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(doc.size)} · {doc.chunkCount} chunks
            </p>
            {doc.error && <p className="text-xs text-destructive">{doc.error}</p>}
          </div>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[doc.status])}>
            {doc.status}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleting === doc.id}
            onClick={() => void handleDelete(doc.id)}
          >
            {deleting === doc.id ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
