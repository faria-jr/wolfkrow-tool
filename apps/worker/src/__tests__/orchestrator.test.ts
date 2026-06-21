import { MockProvider, type AIProviderFactory, type StreamChunk } from '@wolfkrow/infra';
import keytar from 'keytar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrchestratorService } from '../orchestrator';

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(),
    setPassword: vi.fn(),
  },
}));

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

const mockFactory: AIProviderFactory = {
  create: (_provider: string, _key: string) => new MockProvider(['Hello', ' world']),
};

describe('OrchestratorService', () => {
  beforeEach(() => {
    vi.mocked(keytar.getPassword).mockResolvedValue('test-api-key');
  });

  it('streams chunks from provider via factory', async () => {
    const orchestrator = new OrchestratorService({ factory: mockFactory });
    const chunks = await collect(
      orchestrator.stream({ messages: [{ role: 'user', content: 'hi' }], model: 'claude-3-5-sonnet-20241022' }),
    );
    const text = chunks.filter((c) => c.delta !== '').map((c) => c.delta).join('');
    expect(text).toBe('Hello world');
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('uses explicit provider name from request', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['explicit']));
    await collect(
      new OrchestratorService({ factory: { create: createSpy } }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o',
        provider: 'codex',
      }),
    );
    expect(createSpy).toHaveBeenCalledWith('codex', 'test-api-key');
  });

  it('infers anthropic provider for claude-* models', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: { create: createSpy } }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'claude-3-5-sonnet-20241022',
      }),
    );
    expect(createSpy).toHaveBeenCalledWith('anthropic', expect.any(String));
  });

  it('infers codex provider for gpt-* models', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: { create: createSpy } }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'gpt-4o',
      }),
    );
    expect(createSpy).toHaveBeenCalledWith('codex', expect.any(String));
  });

  it('infers ollama provider for llama-* models', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: { create: createSpy } }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'llama-3.2',
      }),
    );
    expect(createSpy).toHaveBeenCalledWith('ollama', 'ollama');
  });

  it('throws when API key missing in keychain', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue(null);
    const orchestrator = new OrchestratorService({ factory: mockFactory });
    await expect(
      collect(orchestrator.stream({ messages: [{ role: 'user', content: 'hi' }], model: 'claude-3-sonnet' })),
    ).rejects.toThrow(/Missing API key/);
  });

  it('passes system prompt through to the query call', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['ok']));
    await collect(
      new OrchestratorService({ factory: { create: createSpy } }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
        system: 'Be helpful',
      }),
    );
    expect(createSpy).toHaveBeenCalled();
  });
});
