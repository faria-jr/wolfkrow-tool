'use client';

import { ShieldCheck } from 'lucide-react';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** A stored durable decision for a (agent, tool) pair. Absent row = "ask". */
interface StoredDecision {
  agentId: string;
  tool: string;
  decision: 'allow' | 'deny';
}

interface AgentData {
  id?: string;
  name: string;
  allowedTools: string[];
  isActive?: boolean;
}

/** Three-state UI value: "ask" means no stored decision (runtime default). */
type UiDecision = 'ask' | 'allow' | 'deny';
type DecisionMap = Record<string, 'allow' | 'deny'>;

const DECISIONS_API = '/api/permissions/decisions';
const AGENTS_API = '/api/agents';

function decisionKey(agentId: string, tool: string): string {
  return `${agentId}::${tool}`;
}

function badgeFor(decision: UiDecision) {
  if (decision === 'allow') return <Badge variant="default">Allow</Badge>;
  if (decision === 'deny') return <Badge variant="destructive">Deny</Badge>;
  return <Badge variant="outline">Ask</Badge>;
}

function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(path, { credentials: 'include', ...opts });
}

function toDecisionMap(decisions: StoredDecision[] | undefined): DecisionMap {
  const map: DecisionMap = {};
  for (const d of decisions ?? []) map[decisionKey(d.agentId, d.tool)] = d.decision;
  return map;
}

/** Load agents + stored decisions in parallel. Throws on any failure. */
async function loadPermissions(): Promise<{ agents: AgentData[]; decisions: DecisionMap }> {
  const [agentsRes, decRes] = await Promise.all([apiFetch(AGENTS_API), apiFetch(DECISIONS_API)]);
  if (!agentsRes.ok) throw new Error('Failed to load agents');
  if (!decRes.ok) throw new Error('Failed to load permissions');
  const agentsJson = (await agentsRes.json()) as { agents: AgentData[] };
  const decJson = (await decRes.json()) as { decisions: StoredDecision[] };
  return { agents: agentsJson.agents ?? [], decisions: toDecisionMap(decJson.decisions) };
}

function applyDecision(
  decisions: DecisionMap,
  key: string,
  value: 'allow' | 'deny' | undefined
): DecisionMap {
  const next = { ...decisions };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

interface LoadState {
  agents: AgentData[];
  decisions: DecisionMap;
}

function usePermissionsLoad(): readonly [
  LoadState,
  boolean,
  string | null,
  Dispatch<SetStateAction<LoadState>>,
  () => Promise<void>,
] {
  const [state, setState] = useState<LoadState>({ agents: [], decisions: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await loadPermissions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await loadPermissions();
        if (!cancelled) setState(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return [state, loading, error, setState, run] as const;
}

interface AgentToolbarProps {
  agents: AgentData[];
  selectedAgent: string;
  onSelect: (id: string) => void;
}

function AgentToolbar({ agents, selectedAgent, onSelect }: AgentToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {agents.map((a) => {
        const id = a.id ?? a.name;
        return (
          <Button
            key={id}
            variant={id === selectedAgent ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect(id)}
          >
            {a.name}
          </Button>
        );
      })}
    </div>
  );
}

interface ToolRowProps {
  agentId: string;
  tool: string;
  stored: 'allow' | 'deny' | undefined;
  disabled: boolean;
  onChange: (agentId: string, tool: string, next: UiDecision) => void;
}

function ToolRow({ agentId, tool, stored, disabled, onChange }: ToolRowProps) {
  const value: UiDecision = stored ?? 'ask';
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">{tool}</p>
        <div className="text-muted-foreground text-xs">{badgeFor(value)}</div>
      </div>
      <Select
        value={value}
        onValueChange={(next) => onChange(agentId, tool, next as UiDecision)}
        disabled={disabled}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ask">Ask</SelectItem>
          <SelectItem value="allow">Allow</SelectItem>
          <SelectItem value="deny">Deny</SelectItem>
        </SelectContent>
      </Select>
    </li>
  );
}

interface AgentToolsCardProps {
  agent: AgentData;
  decisions: DecisionMap;
  mutating: string | null;
  onChange: (agentId: string, tool: string, next: UiDecision) => void;
}

function AgentToolsCard({ agent, decisions, mutating, onChange }: AgentToolsCardProps) {
  const agentId = agent.id ?? agent.name;
  const tools = agent.allowedTools ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="text-muted-foreground h-4 w-4" />
          {agent.name}
          <span className="text-muted-foreground text-sm font-normal">
            ({tools.length} tool{tools.length === 1 ? '' : 's'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tools.length === 0 ? (
          <EmptyState
            title="This agent declares no tools"
            description="There are no per-tool permissions to manage."
          />
        ) : (
          <ul className="divide-border divide-y">
            {tools.map((tool) => (
              <ToolRow
                key={tool}
                agentId={agentId}
                tool={tool}
                stored={decisions[decisionKey(agentId, tool)]}
                disabled={mutating === decisionKey(agentId, tool)}
                onChange={onChange}
              />
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-4 text-xs">
          <span className="font-medium">Ask</span> = no stored decision (runtime will prompt).
          <span className="font-medium"> Allow</span>/<span className="font-medium">Deny</span> are
          persisted and survive worker restarts.
        </p>
      </CardContent>
    </Card>
  );
}

interface PermissionsContentProps {
  agents: AgentData[];
  decisions: DecisionMap;
  selectedAgent: string;
  mutating: string | null;
  onSelect: (id: string) => void;
  onChange: (agentId: string, tool: string, next: UiDecision) => void;
}

function PermissionsContent({
  agents,
  decisions,
  selectedAgent,
  mutating,
  onSelect,
  onChange,
}: PermissionsContentProps) {
  const current = agents.find((a) => (a.id ?? a.name) === selectedAgent) ?? null;
  return (
    <div className="space-y-4">
      <AgentToolbar agents={agents} selectedAgent={selectedAgent} onSelect={onSelect} />
      {current ? (
        <AgentToolsCard
          agent={current}
          decisions={decisions}
          mutating={mutating}
          onChange={onChange}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Select an agent to manage its tools.</p>
      )}
    </div>
  );
}

function LoadingView() {
  return <p className="text-muted-foreground p-4 text-sm">Loading permissions…</p>;
}

function ErrorView({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <ErrorState
      title="Failed to load permissions"
      description={error}
      retryLabel="Retry"
      onRetry={onRetry}
      className="m-4"
    />
  );
}

function EmptyAgentsView() {
  return (
    <EmptyState
      title="No agents configured"
      description="Create an agent first to manage its tool permissions."
      className="m-4"
    />
  );
}

export function PermissionsView() {
  const [state, loading, error, setState, reload] = usePermissionsLoad();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [mutating, setMutating] = useState<string | null>(null);

  useEffect(() => {
    const first = state.agents[0];
    if (first && !selectedAgent) setSelectedAgent(first.id ?? first.name ?? '');
  }, [state.agents, selectedAgent]);

  const handleChange = useCallback(
    async (agentId: string, tool: string, next: UiDecision) => {
      const key = decisionKey(agentId, tool);
      const prev = state.decisions[key];
      setState((cur) => ({
        ...cur,
        decisions: applyDecision(cur.decisions, key, next === 'ask' ? undefined : next),
      }));
      setMutating(key);
      try {
        const res = await apiFetch(DECISIONS_API, {
          method: next === 'ask' ? 'DELETE' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            next === 'ask' ? { agentId, tool } : { agentId, tool, decision: next }
          ),
        });
        if (!res.ok)
          throw new Error(next === 'ask' ? 'Failed to reset decision' : 'Failed to save decision');
        toast.success(next === 'ask' ? 'Permission reset to Ask' : `Permission set to ${next}`);
      } catch {
        setState((cur) => ({ ...cur, decisions: applyDecision(cur.decisions, key, prev) }));
        toast.error('Failed to save permission');
      } finally {
        setMutating(null);
      }
    },
    [state.decisions, setState]
  );

  if (loading) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={() => void reload()} />;
  if (state.agents.length === 0) return <EmptyAgentsView />;
  return (
    <PermissionsContent
      agents={state.agents}
      decisions={state.decisions}
      selectedAgent={selectedAgent}
      mutating={mutating}
      onSelect={setSelectedAgent}
      onChange={handleChange}
    />
  );
}
