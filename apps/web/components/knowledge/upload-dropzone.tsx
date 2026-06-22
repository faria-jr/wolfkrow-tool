'use client';

import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCEPTED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/markdown',
  'text/plain',
].join(',');

interface Props {
  onUploaded: () => void;
}

interface DropZoneContentProps {
  error: string | null;
  uploading: boolean;
  onSelectFiles: () => void;
}
function DropZoneContent({ error, uploading, onSelectFiles }: DropZoneContentProps) {
  return (
    <>
      <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="mb-1 text-sm font-medium">Drag files here or click to browse</p>
      <p className="mb-4 text-xs text-muted-foreground">PDF, DOCX, CSV, XLSX, MD, TXT — up to 50MB each</p>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      <Button variant="outline" disabled={uploading} onClick={onSelectFiles}>
        <FileText className="mr-2 h-4 w-4" />
        {uploading ? 'Uploading…' : 'Select files'}
      </Button>
    </>
  );
}

export function UploadDropZone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setError(null);

    const arr = Array.from(files);
    let hasError = false;

    for (const file of arr) {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: 'Upload failed' }))) as { error?: string };
        setError(data.error ?? 'Upload failed');
        hasError = true;
      }
    }

    setUploading(false);
    if (!hasError) onUploaded();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <DropZoneContent error={error} uploading={uploading} onSelectFiles={() => inputRef.current?.click()} />
      <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden"
        onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); }}
      />
    </div>
  );
}
