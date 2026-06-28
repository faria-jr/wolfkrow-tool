import { z } from 'zod';

export const agentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  model: z.string().min(1, 'Model is required'),
  effort: z.enum(['low', 'medium', 'high', 'max']),
  thinking: z.boolean(),
  thinkingBudget: z.number().int().positive().optional(),
  maxTurns: z.number().int().min(1, 'maxTurns must be at least 1').max(100, 'maxTurns must be at most 100'),
  allowedTools: z.array(z.string()),
  mcpServers: z.array(z.string()),
  isActive: z.boolean(),
  skills: z.array(z.string()),
  runtime: z.enum(['cloud', 'local', 'codex', 'external', 'claude-compat']),
  provider: z.string().optional(),
  squad: z.enum(['harness', 'workflow', 'enrich', 'custom']).optional(),
  systemPrompt: z.string().optional(),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

export const agentDefaults: AgentFormValues = {
  name: '',
  description: '',
  model: 'claude-sonnet-4-6',
  effort: 'medium',
  thinking: false,
  thinkingBudget: undefined,
  maxTurns: 80,
  allowedTools: [],
  mcpServers: [],
  isActive: true,
  skills: [],
  runtime: 'cloud',
  provider: '',
  squad: undefined,
  systemPrompt: '',
};
