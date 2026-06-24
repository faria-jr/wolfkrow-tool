import { Badge } from '@/components/ui/badge';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  major: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  blocker: 'bg-purple-100 text-purple-800',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge className={SEVERITY_COLORS[severity] ?? 'bg-gray-100 text-gray-800'} variant="outline">
      {severity}
    </Badge>
  );
}
