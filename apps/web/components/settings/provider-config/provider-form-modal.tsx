'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { providerFormSchema } from './schema';
import type { ProviderFormValues } from './schema';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface Props {
  open: boolean;
  initial?: Partial<ProviderFormValues>;
  onSave: (values: ProviderFormValues) => void;
  onClose: () => void;
}

export function ProviderFormModal({ open, initial, onSave, onClose }: Props) {
  const [modelInput, setModelInput] = useState('');

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      id: initial?.id ?? '',
      displayName: initial?.displayName ?? '',
      protocol: initial?.protocol ?? 'openai-compatible',
      baseUrl: initial?.baseUrl ?? '',
      apiKeyAccount: initial?.apiKeyAccount ?? '',
      models: initial?.models ?? [],
      supportsTools: initial?.supportsTools ?? false,
    },
  });

  const models = form.watch('models');

  function buildId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function handleSubmit(values: ProviderFormValues) {
    onSave({ ...values, id: values.id || buildId(values.displayName) });
  }

  function addModel() {
    const trimmed = modelInput.trim();
    if (!trimmed) return;
    form.setValue('models', [...models, trimmed]);
    setModelInput('');
  }

  function removeModel(idx: number) {
    form.setValue('models', models.filter((_, i) => i !== idx));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Provider Configuration</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="protocol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Protocol</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="anthropic-compat">Anthropic-compatible</SelectItem>
                      <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKeyAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API key account</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Models</FormLabel>
              <div className="flex gap-2">
                <Input
                  aria-label="Models"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(); } }}
                  placeholder="model-name"
                />
                <Button type="button" variant="outline" onClick={addModel}>Add model</Button>
              </div>
              {form.formState.errors.models && (
                <p className="text-destructive text-sm">{form.formState.errors.models.message}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {models.map((m, i) => (
                  <span key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm">
                    {m}
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeModel(i)}>×</button>
                  </span>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="supportsTools"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Supports tools</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API key (optional — stored in vault)</FormLabel>
                  <FormControl><Input type="password" placeholder="sk-..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
