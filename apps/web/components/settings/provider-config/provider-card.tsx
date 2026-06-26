import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ProviderRow {
  id: string;
  displayName: string;
  protocol: 'anthropic-compat' | 'openai-compatible';
  baseUrl: string;
  apiKeyAccount: string;
  models: readonly string[];
  supportsTools: boolean;
  hasApiKey: boolean;
}

interface ProviderCardProps {
  provider: ProviderRow;
  isBuiltIn: boolean;
  onEdit: () => void;
  onDelete?: () => void;
}

export function ProviderCard({ provider, isBuiltIn, onEdit, onDelete }: ProviderCardProps) {
  return (
    <Card key={provider.id}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{provider.displayName}</CardTitle>
            <p className="text-muted-foreground text-xs mt-0.5">{provider.baseUrl}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{provider.protocol}</Badge>
            {isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
            {provider.supportsTools && <Badge variant="secondary">Tools</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {provider.models.slice(0, 3).map((m) => (
              <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-xs">{m}</span>
            ))}
            {provider.models.length > 3 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">+{provider.models.length - 3}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              {isBuiltIn ? 'Override' : 'Edit'}
            </Button>
            {!isBuiltIn && (
              <Button size="sm" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
