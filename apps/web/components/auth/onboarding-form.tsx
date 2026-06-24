'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BUILT_IN_PROVIDERS } from '@wolfkrow/domain';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';


import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const step1Schema = z
  .object({
    password: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain at least one letter')
      .regex(/\d/, 'Must contain at least one number'),
    confirmPassword: z.string(),
    displayName: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type Step1Form = z.infer<typeof step1Schema>;
type OnboardingStep = 1 | 2 | 3;

const PROVIDERS = BUILT_IN_PROVIDERS.map((p) => ({
  value: p.id,
  label: p.displayName,
  isLocal: p.id === 'ollama',
}));

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: { password: '', confirmPassword: '', displayName: '' },
  });

  async function onStep1Submit({ password, displayName }: Step1Form) {
    setSubmitError(null);
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirmPassword: password, displayName }),
    });
    const data = (await res.json()) as Record<string, string>;
    if (!res.ok) { setSubmitError(data.error ?? 'Setup failed'); return; }
    setStep(2);
  }

  if (step === 3) {
    return <CompletionStep onContinue={() => router.push('/chat')} />;
  }
  if (step === 2) {
    return <ProviderStep onDone={() => setStep(3)} />;
  }
  return <PasswordSetupForm form={form} error={submitError} onSubmit={onStep1Submit} />;
}

interface ProviderFormFieldsProps {
  provider: string;
  apiKey: string;
  onProviderChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
}

function ProviderFormFields({ provider, apiKey, onProviderChange, onApiKeyChange }: ProviderFormFieldsProps) {
  const selected = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium" htmlFor="provider-select">Provider</label>
        <select id="provider-select" value={provider} onChange={(e) => onProviderChange(e.target.value)} className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm">
          {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {selected && !selected.isLocal && (
        <div>
          <label className="text-sm font-medium" htmlFor="api-key-input">API Key</label>
          <Input id="api-key-input" type="password" placeholder={`API key for ${selected.label}`} value={apiKey} onChange={(e) => onApiKeyChange(e.target.value)} className="mt-1" />
        </div>
      )}
    </div>
  );
}

function ProviderStep({ onDone }: { onDone: () => void }) {
  const [provider, setProvider] = useState<string>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: provider, value: apiKey }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Failed to save');
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Set up your AI provider</h2>
        <p className="text-muted-foreground text-sm">Connect an API key to start chatting. You can change this later in Vault.</p>
      </div>
      <ProviderFormFields provider={provider} apiKey={apiKey} onProviderChange={setProvider} onApiKeyChange={setApiKey} />
      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={() => void handleSave()} disabled={saving || (provider !== 'ollama' && !apiKey.trim())} className="flex-1">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save'}
        </Button>
        <Button variant="outline" onClick={onDone}>Skip</Button>
      </div>
    </div>
  );
}

type SetupFormProps = {
  form: ReturnType<typeof useForm<Step1Form>>;
  error: string | null;
  onSubmit: (v: Step1Form) => Promise<void>;
};

function PasswordSetupForm({ form, error, onSubmit }: SetupFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input {...field} type="password" placeholder="Min 8 chars, letter + number" autoComplete="new-password" autoFocus />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm Password</FormLabel>
            <FormControl>
              <Input {...field} type="password" placeholder="Repeat password" autoComplete="new-password" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="displayName" render={({ field }) => (
          <FormItem>
            <FormLabel>Display Name (optional)</FormLabel>
            <FormControl>
              <Input {...field} type="text" placeholder="Your name" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
            : 'Create account'}
        </Button>
      </form>
    </Form>
  );
}

function CompletionStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">You&apos;re all set!</h2>
        <p className="text-sm text-muted-foreground">Your account has been created. Welcome to Wolfkrow.</p>
      </div>
      <Button className="w-full" onClick={onContinue}>Go to app</Button>
    </div>
  );
}
