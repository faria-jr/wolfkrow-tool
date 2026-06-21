'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { AgentFormBody } from './agent-form-body';
import { agentDefaults, agentSchema } from './schema';
import type { AgentFormValues } from './schema';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';

export interface AgentData {
  id?: string;
  name: string;
  description?: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'max';
  thinking: boolean;
  thinkingBudget?: number;
  maxTurns: number;
  allowedTools: string[];
  mcpServers: string[];
  isActive: boolean;
  skills: string[];
  runtime: 'cloud' | 'local' | 'codex' | 'external';
  squad?: string;
  systemPrompt?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AgentFormValues) => void;
  agent?: AgentData;
  loading?: boolean;
}

function buildDefaultValues(agent?: AgentData): AgentFormValues {
  if (!agent) return agentDefaults;
  return {
    name: agent.name,
    description: agent.description ?? '',
    model: agent.model,
    effort: agent.effort,
    thinking: agent.thinking,
    maxTurns: agent.maxTurns,
    allowedTools: agent.allowedTools,
    mcpServers: agent.mcpServers,
    isActive: agent.isActive,
    skills: agent.skills,
    runtime: agent.runtime,
    systemPrompt: agent.systemPrompt ?? '',
    ...(agent.thinkingBudget !== undefined ? { thinkingBudget: agent.thinkingBudget } : {}),
    ...(agent.squad !== undefined ? { squad: agent.squad as AgentFormValues['squad'] } : {}),
  };
}

export function AgentFormModal({ open, onClose, onSubmit, agent, loading }: Props) {
  const form = useForm<AgentFormValues>({ resolver: zodResolver(agentSchema), defaultValues: buildDefaultValues(agent) });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit agent' : 'New agent'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AgentFormBody control={form.control} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
