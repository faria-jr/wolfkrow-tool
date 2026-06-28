import { describe, expect, it } from 'vitest';

import { AskUserTool, ASK_USER_SENTINEL, parseAskUserResult } from '../ask-user-tool';

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
    const parsed = parseAskUserResult(r.output);
    expect(parsed).not.toBeNull();
    expect(parsed?.question).toBe('Pick one');
    expect(parsed?.options).toEqual(['a', 'b']);
  });

  it('parseAskUserResult returns null for non-sentinel output', () => {
    expect(parseAskUserResult('just text')).toBeNull();
    expect(parseAskUserResult(JSON.stringify({ foo: 'bar' }))).toBeNull();
    expect(parseAskUserResult(JSON.stringify({ __type: 'something_else' }))).toBeNull();
  });

  it('exposes the sentinel constant', () => {
    expect(ASK_USER_SENTINEL).toBe('__wolfkrow_ask_user');
  });

  it('defaults options to empty array when missing', async () => {
    const tool = new AskUserTool();
    const r = await tool.execute({ question: 'Open question' }, ctx);
    const parsed = parseAskUserResult(r.output);
    expect(parsed?.options).toEqual([]);
  });

  it('returns error when question is missing', async () => {
    const tool = new AskUserTool();
    const r = await tool.execute({}, ctx);
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/question is required/);
  });
});
