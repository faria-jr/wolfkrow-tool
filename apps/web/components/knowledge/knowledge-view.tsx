'use client';

import { useCallback, useEffect, useState } from 'react';

import { DocumentList } from './document-list';
import { SearchPanel } from './search-panel';
import { UploadDropZone } from './upload-dropzone';

interface DocumentData {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error?: string;
  chunkCount: number;
  createdAt: string;
}

export function KnowledgeView() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [tab, setTab] = useState<'documents' | 'search'>('documents');

  const loadDocs = useCallback(async () => {
    const res = await fetch('/api/knowledge/documents', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { documents: DocumentData[] };
      setDocuments(data.documents ?? []);
    }
  }, []);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  return (
    <div className="space-y-6">
      <UploadDropZone onUploaded={() => void loadDocs()} />

      <div className="flex gap-1 border-b">
        {(['documents', 'search'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t}
            {t === 'documents' && documents.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {documents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'documents' && (
        <DocumentList documents={documents} onDeleted={() => void loadDocs()} />
      )}
      {tab === 'search' && <SearchPanel />}
    </div>
  );
}
