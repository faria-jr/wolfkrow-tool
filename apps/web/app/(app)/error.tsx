'use client';

import { AlertOctagon } from 'lucide-react';
import { useEffect } from 'react';

import { ErrorState } from '@/components/common/error-state';

/**
 * Route-level error boundary for the whole `(app)` group. Any uncaught
 * runtime error in a nested route renders this instead of a white screen,
 * and offers a retry that re-attempts the failed segment.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the browser console for debugging; production logging
    // should be wired separately (observability follow-up).
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <ErrorState
        title="Something went wrong"
        description={error.message || 'An unexpected error occurred while rendering this page.'}
        icon={<AlertOctagon className="h-6 w-6" />}
        onRetry={reset}
      />
    </div>
  );
}
