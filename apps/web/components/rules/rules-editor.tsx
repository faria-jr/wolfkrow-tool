'use client';

import { Copy, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { RULE_KIND_LABELS, type RuleData } from './rule-types';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(path, { credentials: 'include', ...opts });
}

async function fetchRules(): Promise<RuleData[]> {
  const res = await apiFetch('/api/rules');
  if (!res.ok) throw new Error(`Failed to load rules (HTTP ${res.status})`);
  return ((await res.json()) as { rules: RuleData[] }).rules;
}

interface RuleRowProps {
  rule: RuleData;
  onEdit: (rule: RuleData) => void;
  onDuplicate: (rule: RuleData) => void;
  onToggle: (rule: RuleData) => void;
  onDelete: (rule: RuleData) => void;
}

function RuleRow({ rule, onEdit, onDuplicate, onToggle, onDelete }: RuleRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{rule.title}</div>
          <p className="text-muted-foreground max-w-md truncate text-sm">{rule.body}</p>
        </div>
      </TableCell>
      <TableCell>{RULE_KIND_LABELS[rule.kind]}</TableCell>
      <TableCell>
        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
          {rule.enabled ? 'enabled' : 'disabled'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(rule)} aria-label="Edit rule">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDuplicate(rule)}
            aria-label="Duplicate rule"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onToggle(rule)}>
            {rule.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(rule)}
            aria-label="Delete rule"
          >
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function useRulesData() {
  const [rules, setRules] = useState<RuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules(await fetchRules());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load rules'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);
  return { rules, loading, error, loadRules };
}

function useRuleMutations(loadRules: () => Promise<void>) {
  const duplicate = useCallback(
    async (rule: RuleData) => {
      const payload = {
        kind: rule.kind,
        title: `${rule.title} copy`,
        body: rule.body,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder,
      };
      try {
        const res = await apiFetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        toast.success('Rule duplicated');
        await loadRules();
      } catch {
        toast.error('Failed to duplicate rule');
      }
    },
    [loadRules]
  );

  const toggle = useCallback(
    async (rule: RuleData) => {
      try {
        const res = await apiFetch(`/api/rules/${rule.id}/toggle`, { method: 'POST' });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        toast.success('Rule updated');
        await loadRules();
      } catch {
        toast.error('Failed to toggle rule');
      }
    },
    [loadRules]
  );

  const remove = useCallback(
    async (rule: RuleData) => {
      try {
        const res = await apiFetch(`/api/rules/${rule.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        toast.success('Rule deleted');
        await loadRules();
      } catch {
        toast.error('Failed to delete rule');
      }
    },
    [loadRules]
  );

  return { duplicate, toggle, remove };
}

export function RulesEditor() {
  const router = useRouter();
  const { rules, loading, error, loadRules } = useRulesData();
  const { duplicate, toggle, remove } = useRuleMutations(loadRules);
  const [toDelete, setToDelete] = useState<RuleData | null>(null);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error)
    return (
      <ErrorState
        title="Failed to load rules"
        description={error.message}
        onRetry={() => void loadRules()}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => router.push('/rules/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New rule
        </Button>
      </div>
      {rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          description="Create one to shape global prompt behavior."
          icon={<ScrollText className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onEdit={() => router.push(`/rules/${rule.id}/edit`)}
                  onDuplicate={(r) => void duplicate(r)}
                  onToggle={(r) => void toggle(r)}
                  onDelete={setToDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete rule"
        description={toDelete ? `Delete ${toDelete.title}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={() => toDelete && void remove(toDelete).finally(() => setToDelete(null))}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
