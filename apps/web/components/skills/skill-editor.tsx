'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { MarkdownEditor } from '@/components/common/markdown-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

interface ActionsProps { onSave: () => void; onCancel: () => void; loading: boolean | undefined; }
interface ActionsLabels { saveLabel?: string; savingLabel?: string; }

function SkillFormActions({ onSave, onCancel, loading, saveLabel = 'Save skill', savingLabel = 'Saving…' }: ActionsProps & ActionsLabels) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onSave} disabled={loading}>{loading ? savingLabel : saveLabel}</Button>
    </div>
  );
}

interface SkillFormFieldsProps {
  control: ReturnType<typeof useForm<SkillEditorValues>>['control'];
  readOnly: boolean | undefined;
  tags: string[];
  content: string;
  onTagsChange: (tags: string[]) => void;
  onContentChange: (value: string) => void;
}

function SkillFormFields({ control, readOnly, tags, content, onTagsChange, onContentChange }: SkillFormFieldsProps) {
  return (
    <>
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
        <TagField tags={tags} onChange={readOnly ? () => undefined : onTagsChange} disabled={readOnly} />
      </div>
      <MarkdownEditor value={content} onChange={onContentChange} disabled={readOnly ?? false} label="Skill content" />
    </>
  );
}

interface Props {
  initialValues?: Partial<SkillEditorValues>;
  onSave: (values: SkillEditorValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  readOnly?: boolean;
  saveLabel?: string;
}

export function SkillEditor({ initialValues, onSave, onCancel, loading, readOnly, saveLabel }: Props) {
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
  const actionLabels = saveLabel ? { saveLabel } : {};

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4">
        <SkillFormFields
          control={control}
          readOnly={readOnly}
          tags={tags}
          content={content}
          onTagsChange={(t) => setValue('tags', t)}
          onContentChange={(v) => setValue('content', v)}
        />
        {!readOnly && (
          <SkillFormActions
            onSave={handleSubmit((v) => { void onSave(v); })}
            onCancel={onCancel}
            loading={Boolean(loading)}
            {...actionLabels}
          />
        )}
      </div>
    </Form>
  );
}
