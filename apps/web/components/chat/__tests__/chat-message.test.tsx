import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatMessage } from '../chat-message';
import type { DisplayMessage } from '../chat-message';

function msg(overrides: Partial<DisplayMessage> = {}): DisplayMessage {
  return {
    id: 'm1',
    role: 'user',
    content: 'Hello world',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('ChatMessage', () => {
  it('renders user message content', () => {
    render(<ChatMessage message={msg({ content: 'Hi there' })} />);
    expect(screen.getByText('Hi there')).toBeTruthy();
  });

  it('user message has data-role=user', () => {
    const { container } = render(<ChatMessage message={msg({ role: 'user' })} />);
    expect(container.querySelector('[data-role="user"]')).toBeTruthy();
  });

  it('assistant message has data-role=assistant', () => {
    const { container } = render(
      <ChatMessage message={msg({ role: 'assistant', content: 'Reply' })} />
    );
    expect(container.querySelector('[data-role="assistant"]')).toBeTruthy();
  });

  it('renders tool calls when present', () => {
    render(
      <ChatMessage
        message={msg({
          role: 'assistant',
          toolCalls: [
            { id: 'tc1', name: 'web_search', input: {}, status: 'done', output: 'found results' },
          ],
        })}
      />
    );
    expect(screen.getByText('web_search')).toBeTruthy();
  });

  it('does not render tool calls section when empty', () => {
    const { container } = render(
      <ChatMessage message={msg({ role: 'assistant', toolCalls: [] })} />
    );
    expect(container.querySelector('[role="article"]')).toBeNull();
  });

  it('renders bold markdown in assistant messages (#36)', () => {
    const { container } = render(
      <ChatMessage message={msg({ role: 'assistant', content: '**bold text**' })} />
    );
    expect(container.querySelector('strong')).toBeTruthy();
  });

  it('renders code block in assistant messages (#36)', () => {
    const { container } = render(
      <ChatMessage message={msg({ role: 'assistant', content: '```\ncode here\n```' })} />
    );
    expect(container.querySelector('pre')).toBeTruthy();
  });

  it('renders inline code in assistant messages (#36)', () => {
    const { container } = render(
      <ChatMessage message={msg({ role: 'assistant', content: 'Use `code` inline' })} />
    );
    expect(container.querySelector('code')).toBeTruthy();
  });

  it('user message renders as plain text, not markdown (#36)', () => {
    const { container } = render(
      <ChatMessage message={msg({ role: 'user', content: '**not bold**' })} />
    );
    expect(container.querySelector('strong')).toBeNull();
  });
});
