import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export const metadata = {
  title: 'Sign In',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
            <span className="text-2xl font-bold text-white">W</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Enter your password to continue
          </p>
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
