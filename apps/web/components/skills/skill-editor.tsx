'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export const skillSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()),
});

export type SkillEditorValues = z.infer<typeof skillSchema>;

function buildDefaults(v: Partial<SkillEditorValues> | undefined): SkillEditorValues {
  return {
    name: v?.name ?? '',
    description: v?.description ?? '',
    content: v?.content ?? '',
    tags: v?.tags ?? ([] as string[]),
  };
}

interface TagFieldProps {
  tags: string[];
  onChange: (t: string[]) => void;
  disabled: boolean | undefined;
}

function TagField({ tags, onChange, disabled }: TagFieldProps) {
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
      <Input placeholder="Type tag + Enter" onKeyDown={handleKeyDown} disabled={disabled} />
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
        <div className="prose prose-sm dark:prose-invert min-h-48 rounded-md border p-4">
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

interface Props {
  initialValues?: Partial<SkillEditorValues>;
  onSave: (values: SkillEditorValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  readOnly?: boolean;
}

export function SkillEditor({ initialValues, onSave, onCancel, loading, readOnly }: Props) {
  const form = useForm<SkillEditorValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: buildDefaults(initialValues),
    mode: 'onSubmit',
  });

  // Reset form values when initialValues change (switching between
  // new/edit). Without this, useForm keeps stale defaultValues on edit.
  useEffect(() => {
    form.reset(buildDefaults(initialValues));
  }, [initialValues, form]);

  const { control, handleSubmit, watch, setValue } = form;
  const tags = watch('tags');
  const content = watch('content');

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="e.g. pdf-processing" disabled={readOnly} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="Brief description" disabled={readOnly} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label>Tags</Label>
          <TagField tags={tags} onChange={readOnly ? () => undefined : (t) => setValue('tags', t)} disabled={readOnly} />
        </div>
        <SkillContentTabs content={content} onChange={(v) => setValue('content', v)} disabled={readOnly} />
        {!readOnly && <SkillFormActions onSave={handleSubmit((v) => { void onSave(v); })} onCancel={onCancel} loading={loading} />}
      </div>
    </Form>
  );
}
