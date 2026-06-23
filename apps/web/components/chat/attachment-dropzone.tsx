'use client';

import { useRef } from 'react';

export interface AttachmentData {
  filename: string;
  mimeType: string;
  data: string; // base64
}

interface AttachmentDropzoneProps {
  onAttach: (attachments: AttachmentData[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AttachmentDropzone({ onAttach, onError, disabled }: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const results: AttachmentData[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        onError(`"${file.name}" excede o limite de 5 MB.`);
        return;
      }
      if (!ACCEPTED_TYPES.has(file.type)) {
        onError(`Tipo "${file.type}" não suportado.`);
        return;
      }
      const data = await toBase64(file);
      results.push({ filename: file.name, mimeType: file.type, data });
    }
    if (results.length) onAttach(results);
  }

  return (
    <div
      data-testid="attachment-dropzone"
      className="relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Anexar arquivo"
        className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
      >
        📎
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
