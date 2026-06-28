import { Badge } from '@/components/ui/badge';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
  major: 'bg-warning/15 text-warning',
  critical: 'bg-destructive/15 text-destructive',
  blocker: 'bg-destructive/15 text-destructive',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      className={SEVERITY_COLORS[severity] ?? 'bg-muted text-muted-foreground'}
      variant="outline"
    >
      {severity}
    </Badge>
  );
}
