'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { ProviderFormFields } from './provider-form-fields';
import { providerFormSchema, type ProviderFormValues } from './schema';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';

interface Props {
  open: boolean;
  initial?: Partial<ProviderFormValues>;
  onSave: (values: ProviderFormValues) => void;
  onClose: () => void;
}

function buildId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildDefaultValues(initial?: Partial<ProviderFormValues>): ProviderFormValues {
  const defaults: ProviderFormValues = {
    id: '',
    displayName: '',
    protocol: 'openai-compatible',
    baseUrl: '',
    apiKeyAccount: '',
    models: [],
    supportsTools: false,
  };
  return { ...defaults, ...initial };
}

export function ProviderFormModal({ open, initial, onSave, onClose }: Props) {
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: buildDefaultValues(initial),
  });

  function handleSubmit(values: ProviderFormValues) {
    onSave({ ...values, id: values.id || buildId(values.displayName) });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Provider Configuration</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <ProviderFormFields form={form} />

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
