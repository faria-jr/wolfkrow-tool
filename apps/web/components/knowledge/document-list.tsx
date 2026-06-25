'use client';

import { FileText, Trash2, RefreshCw } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
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

interface DocumentItemProps {
  doc: DocumentProps;
  deleting: boolean;
  onRequestDelete: (doc: DocumentProps) => void;
}

const DocumentItem = memo(function DocumentItem({ doc, deleting, onRequestDelete }: DocumentItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
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
        disabled={deleting}
        aria-label={`Delete ${doc.filename}`}
        onClick={() => onRequestDelete(doc)}
      >
        {deleting ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
});

interface DocumentListBodyProps {
  documents: DocumentProps[];
  deletingId: string | null;
  onRequestDelete: (doc: DocumentProps) => void;
}
function DocumentListBody({ documents, deletingId, onRequestDelete }: DocumentListBodyProps) {
  return (
    <div className="divide-y rounded-lg border">
      {documents.map((doc) => (
        <DocumentItem
          key={doc.id}
          doc={doc}
          deleting={deletingId === doc.id}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}

interface DeleteState {
  deletingId: string | null;
  pendingDoc: DocumentProps | null;
  requestDelete: (doc: DocumentProps) => void;
  confirmDelete: (doc: DocumentProps) => Promise<void>;
  cancelDelete: () => void;
}
function useDocumentDelete(onDeleted: () => void): DeleteState {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<DocumentProps | null>(null);

  const confirmDelete = useCallback(async (doc: DocumentProps) => {
    setDeletingId(doc.id);
    setPendingDoc(null);
    try {
      const res = await fetch(`/api/knowledge/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Failed to delete document');
        return;
      }
      toast.success('Document deleted');
      onDeleted();
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  }, [onDeleted]);

  return {
    deletingId,
    pendingDoc,
    requestDelete: setPendingDoc,
    confirmDelete,
    cancelDelete: () => setPendingDoc(null),
  };
}

export function DocumentList({ documents, onDeleted }: Props) {
  const del = useDocumentDelete(onDeleted);

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No documents yet. Upload some files above.</p>
      </div>
    );
  }

  return (
    <>
      <DocumentListBody
        documents={documents}
        deletingId={del.deletingId}
        onRequestDelete={del.requestDelete}
      />
      <ConfirmDialog
        open={del.pendingDoc !== null}
        title="Delete document"
        description={
          del.pendingDoc
            ? `Delete "${del.pendingDoc.filename}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => del.pendingDoc && void del.confirmDelete(del.pendingDoc)}
        onCancel={del.cancelDelete}
      />
    </>
  );
}
