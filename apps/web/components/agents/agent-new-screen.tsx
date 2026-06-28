'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { AgentFormBody } from './agent-form-body';
import { agentDefaults, agentSchema } from './schema';
import type { AgentFormValues } from './schema';

import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';

async function createAgent(values: AgentFormValues): Promise<void> {
  const res = await fetch('/api/agents', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Create failed (HTTP ${res.status})`);
  }
}

export function AgentNewScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: agentDefaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await createAgent(values);
      toast.success('Agent created');
      router.push('/agents');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <AgentFormBody control={form.control} />
        <div className="border-border flex justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/agents')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Creating…' : 'Create agent'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
