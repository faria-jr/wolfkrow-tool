'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { ProviderFormFields } from './provider-form-fields';
import { buildProviderFormValues, resolveProviderId } from './provider-form-helpers';
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

export function ProviderFormModal({ open, initial, onSave, onClose }: Props) {
  const isEditing = Boolean(initial?.id);
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: buildProviderFormValues(initial),
  });

  useEffect(() => {
    form.reset(buildProviderFormValues(initial));
  }, [initial, form]);

  function handleSubmit(values: ProviderFormValues) {
    onSave(resolveProviderId(values, isEditing ? initial?.id : undefined));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Provider' : 'Provider Configuration'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <ProviderFormFields form={form} isEditing={isEditing} />
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
