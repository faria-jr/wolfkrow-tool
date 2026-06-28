import * as React from 'react';

import { cn } from '@/lib/utils';

const Kbd = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium',
        className
      )}
      {...props}
    />
  )
);
Kbd.displayName = 'Kbd';

export { Kbd };
