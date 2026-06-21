'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});
type PasswordForm = z.infer<typeof passwordSchema>;

const totpSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Digits only'),
});
type TotpForm = z.infer<typeof totpSchema>;

type LoginStep = 'password' | 'totp';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirect') ?? '/chat';

  const [step, setStep] = useState<LoginStep>('password');
  const [pendingUserId, setPendingUserId] = useState('');
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });
  const totpForm = useForm<TotpForm>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: '' },
  });

  async function onPasswordSubmit({ password }: PasswordForm) {
    setSubmitError(null);
    setLockedUntil(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as Record<string, string>;
    if (res.status === 423) { setLockedUntil(data.lockedUntil ?? null); return; }
    if (!res.ok) { setSubmitError(data.error ?? 'Authentication failed'); return; }
    if (data.status === 'requires_totp') { setPendingUserId(data.userId ?? ''); setStep('totp'); return; }
    router.push(redirectTo);
    router.refresh();
  }

  async function onTotpSubmit({ code }: TotpForm) {
    setSubmitError(null);
    const res = await fetch('/api/auth/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pendingUserId, code }),
    });
    const data = (await res.json()) as Record<string, string>;
    if (!res.ok) { setSubmitError(data.error ?? 'Invalid code'); return; }
    router.push(redirectTo);
    router.refresh();
  }

  if (lockedUntil) {
    return <LockedMessage lockedUntil={lockedUntil} onRetry={() => setLockedUntil(null)} />;
  }
  if (step === 'totp') {
    return (
      <TotpStep form={totpForm} error={submitError} onSubmit={onTotpSubmit} onBack={() => setStep('password')} />
    );
  }
  return <PasswordStep form={passwordForm} error={submitError} onSubmit={onPasswordSubmit} />;
}

type PasswordStepProps = {
  form: ReturnType<typeof useForm<PasswordForm>>;
  error: string | null;
  onSubmit: (v: PasswordForm) => Promise<void>;
};

function PasswordStep({ form, error, onSubmit }: PasswordStepProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input {...field} type="password" placeholder="Enter your password" autoComplete="current-password" autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <SubmitButton isLoading={form.formState.isSubmitting} label="Sign in" loadingLabel="Signing in…" />
        <p className="text-center text-sm text-muted-foreground">
          First time?{' '}
          <a href="/onboarding" className="underline hover:text-foreground">Set up your account</a>
        </p>
      </form>
    </Form>
  );
}

type TotpStepProps = {
  form: ReturnType<typeof useForm<TotpForm>>;
  error: string | null;
  onSubmit: (v: TotpForm) => Promise<void>;
  onBack: () => void;
};

function TotpStep({ form, error, onSubmit, onBack }: TotpStepProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authenticator Code</FormLabel>
              <FormControl>
                <Input {...field} type="text" inputMode="numeric" placeholder="000000" autoFocus maxLength={6} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <SubmitButton isLoading={form.formState.isSubmitting} label="Verify" loadingLabel="Verifying…" />
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>Back</Button>
      </form>
    </Form>
  );
}

type LockedMessageProps = { lockedUntil: string; onRetry: () => void };

function LockedMessage({ lockedUntil, onRetry }: LockedMessageProps) {
  const until = new Date(lockedUntil).toLocaleTimeString();
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-destructive" role="alert">
        Too many failed attempts. Try again after {until}.
      </p>
      <Button variant="outline" onClick={onRetry} className="w-full">Try again</Button>
    </div>
  );
}

type SubmitButtonProps = { isLoading: boolean; label: string; loadingLabel: string };

function SubmitButton({ isLoading, label, loadingLabel }: SubmitButtonProps) {
  return (
    <Button type="submit" className="w-full" disabled={isLoading}>
      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loadingLabel}</> : label}
    </Button>
  );
}
