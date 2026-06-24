import { describe, expect, it } from 'vitest';

import { AskUserTool } from '../ask-user-tool';

const ctx = { userId: 'u1' };

describe('AskUserTool', () => {
  it('has correct metadata', () => {
    const tool = new AskUserTool();
    expect(tool.name).toBe('ask_user');
    expect(tool.inputSchema.required).toContain('question');
  });

  it('emits sentinel JSON with question and options', async () => {
    const tool = new AskUserTool();
    const r = await tool.execute({ question: 'Pick one', options: ['a', 'b'] }, ctx);
    expect(r.isError).toBe(false);
    const parsed = JSON.parse(r.output) as { __type: string; question: string; options: string[] };
    expect(parsed.__type).toBe('ask_user');
    expect(parsed.question).toBe('Pick one');
    expect(parsed.options).toEqual(['a', 'b']);
  });

  it('defaults options to empty array when missing', async () => {
    const tool = new AskUserTool();
    const r = await tool.execute({ question: 'Open question' }, ctx);
    const parsed = JSON.parse(r.output) as { options: unknown[] };
    expect(parsed.options).toEqual([]);
  });

  it('returns error when question is missing', async () => {
    const tool = new AskUserTool();
    const r = await tool.execute({}, ctx);
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/question is required/);
  });
});