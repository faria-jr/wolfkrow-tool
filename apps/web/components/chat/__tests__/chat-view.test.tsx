import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatView } from '../chat-view';

interface VoiceMessage {
  role: 'user' | 'assistant';
  text: string;
}

// Mock the voice hook so rendering ChatView never touches Web Audio / VAD.
const voice = vi.hoisted(() => ({
  state: 'idle' as 'idle' | 'listening' | 'processing' | 'speaking',
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  error: null as string | null,
  onMessage: null as null | ((m: VoiceMessage) => void),
}));

vi.mock('@/hooks/use-voice-conversation', () => ({
  useVoiceConversation: (opts?: { onMessage?: (m: VoiceMessage) => void }) => {
    voice.onMessage = opts?.onMessage ?? null;
    return {
      state: voice.state,
      messages: [],
      start: voice.start,
      stop: voice.stop,
      error: voice.error,
    };
  },
}));

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

/**
 * Routes fetch by URL: /api/providers → empty array (ChatView's ModelPicker
 * fetches providers on mount), everything else → the chat-send SSE stream.
 * Returns a FRESH Response per call so the providers fetch doesn't consume the
 * shared SSE body the send relies on.
 */
function mockChatSse(events: string[]): void {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/providers')) {
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return makeSSEResponse(events);
  });
}

describe('ChatView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    voice.state = 'idle';
    voice.error = null;
    voice.start = vi.fn().mockResolvedValue(undefined);
    voice.stop = vi.fn();
    voice.onMessage = null;
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
    expect(screen.getAllByText('hello').length).toBeGreaterThan(0);
  });

  it('streams assistant response text', async () => {
    const user = userEvent.setup();
    mockChatSse([sseEvent({ type: 'text', content: 'Hello' }), sseEvent({ type: 'text', content: ' world' }), sseEvent({ type: 'done' })]);
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

  it('renders the voice orb (FIX-011)', () => {
    render(<ChatView />);
    expect(screen.getByRole('button', { name: /start voice conversation/i })).toBeTruthy();
  });

  it('clicking the voice orb starts the conversation when idle (FIX-011)', async () => {
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: /start voice conversation/i }));
    expect(voice.start).toHaveBeenCalledTimes(1);
    expect(voice.stop).not.toHaveBeenCalled();
  });

  it('clicking the voice orb stops it when active (FIX-011)', async () => {
    voice.state = 'listening';
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: /Listening/i }));
    expect(voice.stop).toHaveBeenCalledTimes(1);
  });

  it('mirrors voice messages into the transcript (FIX-011)', () => {
    render(<ChatView />);
    act(() => {
      voice.onMessage?.({ role: 'user', text: 'hello from voice' });
    });
    expect(screen.getByText('hello from voice')).toBeTruthy();
  });

  it('shows the voice error when present (FIX-011)', () => {
    voice.error = 'mic denied';
    render(<ChatView />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('mic denied')).toBeTruthy();
  });

  it('shows "New Chat" heading initially (#9)', () => {
    render(<ChatView />);
    expect(screen.getByRole('heading', { name: 'New Chat' })).toBeTruthy();
  });

  it('updates heading from first user message (#9)', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(makeSSEResponse([sseEvent({ type: 'done' })]));
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'my first message');
    await user.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'my first message' })).toBeTruthy());
  });

  it('has a clear button (#10)', () => {
    render(<ChatView />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeTruthy();
  });

  it('clear button opens confirm dialog (#10)', async () => {
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('confirming clear removes messages (#10)', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      makeSSEResponse([sseEvent({ type: 'text', content: 'Hi!' }), sseEvent({ type: 'done' })]),
    );
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'hello');
    await user.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getAllByText('hello').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: /clear/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(screen.queryByText('hello')).toBeNull());
    expect(screen.getByText('Start a conversation')).toBeTruthy();
  });

  it('shows Stop button during streaming and returns to Send after abort (T19)', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation((_, opts) => {
      const signal = (opts as RequestInit).signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      });
    });
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'hello');
    await user.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByLabelText('Stop')).toBeTruthy());
    await user.click(screen.getByLabelText('Stop'));
    await waitFor(() => expect(screen.queryByLabelText('Stop')).toBeNull());
    expect(screen.getByLabelText('Send')).toBeTruthy();
  });

  it('renders tool call inline when tool_call SSE event received (T17)', async () => {
    const user = userEvent.setup();
    mockChatSse([
      sseEvent({ type: 'tool_call', id: 'tc-1', name: 'read_file', input: { path: '/foo.txt' } }),
      sseEvent({ type: 'done' }),
    ]);
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'read a file');
    await user.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByLabelText('Tool call: read_file')).toBeTruthy());
  });

  it('shows tool result output when tool_result SSE event received (T17)', async () => {
    const user = userEvent.setup();
    mockChatSse([
      sseEvent({ type: 'tool_call', id: 'tc-1', name: 'read_file', input: { path: '/foo.txt' } }),
      sseEvent({ type: 'tool_result', callId: 'tc-1', output: 'file contents here', isError: false }),
      sseEvent({ type: 'done' }),
    ]);
    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'read a file');
    await user.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByText('file contents here')).toBeTruthy());
  });

  it('shows ConfirmDialog on tool_permission and POSTs the approval (T17 UI)', async () => {
    const user = userEvent.setup();
    // Route by URL: /api/providers → [], /chat/permission → OK, /chat/send → SSE.
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/providers')) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.endsWith('/chat/permission')) return new Response('{}', { status: 200 });
      return makeSSEResponse([
        sseEvent({ type: 'tool_permission', id: 'perm-1', name: 'Write', input: {}, prompt: 'Allow Write?' }),
        sseEvent({ type: 'done' }),
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatView />);
    await user.type(screen.getByLabelText('Chat input'), 'write a file');
    await user.click(screen.getByLabelText('Send'));

    await waitFor(() => expect(screen.getByText('Allow Write?')).toBeTruthy(), { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      const permCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/chat/permission'));
      expect(permCall).toBeDefined();
    });
    const permCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/chat/permission'));
    const init = permCall?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toEqual({ callId: 'perm-1', approved: true });
  });
});
