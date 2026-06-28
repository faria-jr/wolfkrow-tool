'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'border-border flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 truncate text-sm">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
