'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Label override for the retry button (defaults to "Try again"). */
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  icon,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-lg border px-6 py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="bg-destructive/10 text-destructive mb-3 flex h-12 w-12 items-center justify-center rounded-full">
          {icon}
        </div>
      )}
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          {retryLabel ?? 'Try again'}
        </Button>
      )}
    </div>
  );
}
