import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatView } from '../chat-view';

function makeSSEResponse(events: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(new TextEncoder().encode(event));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

describe('ChatView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
  });

  it('renders empty state initially', () => {
    render(<ChatView />);
    expect(screen.getByText('Start a conversation')).toBeTruthy();
  });

  it('renders chat input', () => {
    render(<ChatView />);
    expect(screen.getByLabelText('Chat input')).toBeTruthy();
  });

  it('send button is disabled when input empty', () => {
    render(<ChatView />);
    expect((screen.getByLabelText('Send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('send button enables when input has text', async () => {
    const user = userEvent.setup();
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'hello');
    expect((screen.getByLabelText('Send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows user message and streaming indicator after send', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      makeSSEResponse([sseEvent({ type: 'ack' }), sseEvent({ type: 'text', content: 'Hi!' }), sseEvent({ type: 'done' })]),
    );
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'hello');
    await user.click(screen.getByLabelText('Send'));
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('streams assistant response text', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      makeSSEResponse([sseEvent({ type: 'text', content: 'Hello' }), sseEvent({ type: 'text', content: ' world' }), sseEvent({ type: 'done' })]),
    );
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'hi');
    await user.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByText('Hello world')).toBeTruthy(), { timeout: 3000 });
  });

  it('clears input after send', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(makeSSEResponse([sseEvent({ type: 'done' })]));
    render(<ChatView />);
    const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    await user.type(textarea, 'test message');
    await user.click(screen.getByLabelText('Send'));
    expect(textarea.value).toBe('');
  });
});
