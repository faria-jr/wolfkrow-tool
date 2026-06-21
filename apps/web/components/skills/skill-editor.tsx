'use client';

import { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export interface SkillEditorValues {
  name: string;
  description: string;
  content: string;
  tags: string[];
}

interface Props {
  initialValues?: Partial<SkillEditorValues>;
  onSave: (values: SkillEditorValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  readOnly?: boolean;
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const remove = useCallback((tag: string) => onChange(tags.filter((t) => t !== tag)), [tags, onChange]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = input.value.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); input.value = ''; }
  }, [tags, onChange]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => <Badge key={t} variant="secondary" className="cursor-pointer gap-1" onClick={() => remove(t)}>{t} ×</Badge>)}
      </div>
      <Input placeholder="Type tag + Enter" onKeyDown={handleKeyDown} />
    </div>
  );
}

interface ContentTabsProps { content: string; onChange: (v: string) => void; disabled: boolean | undefined; }

function SkillContentTabs({ content, onChange, disabled }: ContentTabsProps) {
  return (
    <Tabs defaultValue="edit">
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <Textarea value={content} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={16} placeholder="# Skill Title&#10;&#10;Describe the skill capabilities and instructions here..." className="font-mono text-sm" />
      </TabsContent>
      <TabsContent value="preview">
        <div className="prose prose-sm dark:prose-invert min-h-[200px] rounded-md border p-4">
          {content || <span className="text-muted-foreground">No content yet.</span>}
        </div>
      </TabsContent>
    </Tabs>
  );
}

interface ActionsProps { onSave: () => void; onCancel: () => void; loading: boolean | undefined; }

function SkillFormActions({ onSave, onCancel, loading }: ActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onSave} disabled={loading}>{loading ? 'Saving…' : 'Save skill'}</Button>
    </div>
  );
}

function buildInitialState(v: Partial<SkillEditorValues> | undefined) {
  return {
    name: v?.name ?? '',
    description: v?.description ?? '',
    content: v?.content ?? '',
    tags: v?.tags ?? ([] as string[]),
  };
}

export function SkillEditor({ initialValues, onSave, onCancel, loading, readOnly }: Props) {
  const init = buildInitialState(initialValues);
  const [name, setName] = useState(init.name);
  const [description, setDescription] = useState(init.description);
  const [content, setContent] = useState(init.content);
  const [tags, setTags] = useState<string[]>(init.tags);

  const handleSave = useCallback(() => { void onSave({ name, description, content, tags }); }, [name, description, content, tags, onSave]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="skill-name">Name</Label>
          <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="e.g. pdf-processing" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="skill-desc">Description</Label>
          <Input id="skill-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} placeholder="Brief description" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Tags</Label>
        <TagEditor tags={tags} onChange={readOnly ? () => undefined : setTags} />
      </div>
      <SkillContentTabs content={content} onChange={setContent} disabled={readOnly} />
      {!readOnly && <SkillFormActions onSave={handleSave} onCancel={onCancel} loading={loading} />}
    </div>
  );
}
