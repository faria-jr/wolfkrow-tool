import { z } from 'zod';

export const SeedAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  model: z.string().default('claude-sonnet-4-6'),
  effort: z.enum(['low', 'medium', 'high', 'max']).default('medium'),
  thinking: z.boolean().default(false),
  thinkingBudget: z.number().int().positive().optional(),
  maxTurns: z.number().int().min(1).default(80),
  allowedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  skills: z.array(z.string()).default([]),
  runtime: z.enum(['cloud', 'local', 'codex', 'external']).default('cloud'),
  squad: z.enum(['harness', 'workflow', 'enrich', 'custom']).optional(),
  systemPrompt: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type SeedAgent = z.infer<typeof SeedAgentSchema>;
