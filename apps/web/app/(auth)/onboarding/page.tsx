import { Suspense } from 'react';

import { OnboardingForm } from '@/components/auth/onboarding-form';

export const metadata = {
  title: 'Setup',
};

export default function OnboardingPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
            <span className="text-2xl font-bold text-white">W</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Set up Wolfkrow</h1>
          <p className="text-muted-foreground text-sm">
            Create your master password to get started
          </p>
        </div>
        <Suspense fallback={<div className="bg-muted h-48 animate-pulse rounded-md" />}>
          <OnboardingForm />
        </Suspense>
      </div>
    </div>
  );
}
