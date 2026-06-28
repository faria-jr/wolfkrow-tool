'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import remarkGfm from 'remark-gfm';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

/**
 * DEBT #14 (EPIC 3.2) — Reusable Markdown editor: textarea + live rendered
 * preview (react-markdown + remark-gfm, already bundled for chat). Shared by
 * skill/agent/rule editors so the preview renders real markdown instead of the
 * raw string. ReactMarkdown is lazy-loaded (keeps the heavy dep out of the
 * eager bundle, matching chat-message); remark-gfm is a Pluggable (static import).
 */
const ReactMarkdown = dynamic(() => import('react-markdown').then((m) => m.default), {
  ssr: false,
});

export interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  /** Accessible label for the textarea. */
  label?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  disabled,
  rows = 16,
  placeholder,
  label = 'Markdown content',
}: MarkdownEditorProps) {
  const [tab, setTab] = useState('edit');
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder ?? '# Title\n\nDescribe the capabilities and instructions here…'}
          className="font-mono text-sm"
          aria-label={label}
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className="prose prose-sm dark:prose-invert min-h-48 rounded-md border p-4">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <span className="text-muted-foreground">No content yet.</span>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
