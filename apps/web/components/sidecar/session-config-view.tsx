'use client';

import { Loader2, PenTool } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * EPIC 4.2e — Project-scoped design session config form.
 *
 * Compact port of LionClaw SessionConfigView. Differences from the source:
 *   - Wolfkrow uses plain fetch to /api/open-design/bootstrap (no window IPC).
 *   - The agent selector is fixed to claude/codex/gemini; the model is a single
 *     free-text input (LionClaw ships full per-agent model catalogs + a custom
 *     model toggle + a reasoning selector — omitted as debt, tracked below).
 *   - designSystemId is optional free text.
 *   - The bootstrap response carries studioUrl, handed back via onStudioUrl so
 *     the parent can point DesignStudio's iframe at it.
 *
 * Omitted from LionClaw (debt): full per-agent model catalogs, custom-model
 * toggle, reasoning level selector, mcpServerIds/memoryEnabled controls, locale
 * picker (fixed pt-BR server-side).
 */

interface AgentOption {
  value: 'claude' | 'codex' | 'gemini';
  label: string;
  defaultModel: string;
}

const AGENT_OPTIONS: AgentOption[] = [
  { value: 'claude', label: 'Claude Code (Opus/Sonnet/Haiku)', defaultModel: 'sonnet' },
  { value: 'codex', label: 'Codex CLI (GPT/o-series)', defaultModel: 'gpt-5' },
  { value: 'gemini', label: 'Gemini CLI (gemini-*)', defaultModel: 'gemini-2.5-pro' },
];

interface BootstrapResponseBody {
  studioUrl?: string;
  error?: string;
}

interface SessionConfigViewProps {
  wolfkrowProjectId: string;
  name: string;
  specContent: string;
  /** Called with the studio URL returned by the bootstrap endpoint. */
  onStudioUrl: (studioUrl: string) => void;
}

/** Build the POST /api/open-design/bootstrap body, omitting empty designSystemId. */
function buildBootstrapBody(input: {
  wolfkrowProjectId: string;
  name: string;
  specContent: string;
  agentId: string;
  model: string;
  designSystemId: string;
}): Record<string, string> {
  const body: Record<string, string> = {
    wolfkrowProjectId: input.wolfkrowProjectId,
    name: input.name,
    specContent: input.specContent,
    agentId: input.agentId,
    model: input.model,
  };
  const trimmed = input.designSystemId.trim();
  if (trimmed !== '') body.designSystemId = trimmed;
  return body;
}

interface SubmitArgs {
  wolfkrowProjectId: string;
  name: string;
  specContent: string;
  agentId: string;
  model: string;
  designSystemId: string;
  onStudioUrl: (studioUrl: string) => void;
}

/** POST the bootstrap payload; returns an error string on failure, null on success. */
async function submitBootstrap(args: SubmitArgs): Promise<string | null> {
  const body = buildBootstrapBody(args);
  const res = await fetch('/api/open-design/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as BootstrapResponseBody;
  if (!res.ok || !data.studioUrl) return data.error ?? `HTTP ${res.status}`;
  args.onStudioUrl(data.studioUrl);
  return null;
}

interface SessionFormFieldsProps {
  agentId: AgentOption['value'];
  model: string;
  designSystemId: string;
  onAgentChange: (next: string) => void;
  onModelChange: (next: string) => void;
  onDesignSystemChange: (next: string) => void;
}

function SessionFormFields({
  agentId,
  model,
  designSystemId,
  onAgentChange,
  onModelChange,
  onDesignSystemChange,
}: SessionFormFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="od-agent">Agent</Label>
        <Select value={agentId} onValueChange={onAgentChange}>
          <SelectTrigger id="od-agent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="od-model">Model</Label>
        <Input
          id="od-model"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="agent model slug"
        />
        <p className="text-xs text-muted-foreground">
          Enter the exact model slug the agent CLI accepts.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="od-design-system">Design system (optional)</Label>
        <Input
          id="od-design-system"
          value={designSystemId}
          onChange={(e) => onDesignSystemChange(e.target.value)}
          placeholder="e.g. wolfkrow-default, shadcn-zinc"
        />
      </div>
    </>
  );
}

interface SessionConfigCardProps {
  agentId: AgentOption['value'];
  model: string;
  designSystemId: string;
  submitting: boolean;
  error: string | null;
  canSubmit: boolean;
  onAgentChange: (next: string) => void;
  onModelChange: (next: string) => void;
  onDesignSystemChange: (next: string) => void;
  onSubmit: () => void;
}

function SessionConfigCard({
  agentId,
  model,
  designSystemId,
  submitting,
  error,
  canSubmit,
  onAgentChange,
  onModelChange,
  onDesignSystemChange,
  onSubmit,
}: SessionConfigCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PenTool className="size-4 text-primary" />
          Design session
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SessionFormFields
          agentId={agentId}
          model={model}
          designSystemId={designSystemId}
          onAgentChange={onAgentChange}
          onModelChange={onModelChange}
          onDesignSystemChange={onDesignSystemChange}
        />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button className="w-full" disabled={!canSubmit} onClick={onSubmit}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting…
            </>
          ) : (
            'Start session'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function SessionConfigView({
  wolfkrowProjectId,
  name,
  specContent,
  onStudioUrl,
}: SessionConfigViewProps) {
  const [agentId, setAgentId] = useState<AgentOption['value']>('claude');
  const [model, setModel] = useState<string>(AGENT_OPTIONS[0]!.defaultModel);
  const [designSystemId, setDesignSystemId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAgentChange(next: string): void {
    const option = AGENT_OPTIONS.find((a) => a.value === next);
    if (option) {
      setAgentId(option.value);
      setModel(option.defaultModel);
    }
  }

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const submitError = await submitBootstrap({
        wolfkrowProjectId, name, specContent, agentId, model: model.trim(), designSystemId,
        onStudioUrl,
      });
      if (submitError) setError(submitError);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start design session');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && model.trim() !== '';

  return (
    <SessionConfigCard
      agentId={agentId}
      model={model}
      designSystemId={designSystemId}
      submitting={submitting}
      error={error}
      canSubmit={canSubmit}
      onAgentChange={handleAgentChange}
      onModelChange={setModel}
      onDesignSystemChange={setDesignSystemId}
      onSubmit={() => void handleSubmit()}
    />
  );
}
