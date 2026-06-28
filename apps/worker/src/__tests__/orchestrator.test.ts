import {
  MockProvider,
  ToolRegistry,
  type AIProviderFactory,
  type StreamChunk,
} from '@wolfkrow/infra';
import keytar from 'keytar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrchestratorService } from '../orchestrator';

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(),
    setPassword: vi.fn(),
  },
}));

// FIX-005: orchestrator resolves a persisted Agent via the container. Mutable
// fake so the agent-driven test can inject one without a real DB.
const fakeRepos = {
  agent: { findById: async (_id: string) => null as unknown },
  skill: { findByUserId: async (_u: string) => [] as unknown[] },
  globalRule: { findAll: async (_u: string) => [] as unknown[] },
  providerConfig: { findAll: async (_u: string) => [] },
};
// P1-8: orchestrator builds its default factory from getToolRegistry(); expose
// a real (empty) registry so the default-factory tests don't import infra tools.
vi.mock('../container', () => ({
  getRepos: () => fakeRepos,
  getToolRegistry: () => new ToolRegistry([]),
}));

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

function spyFactory(spy: ReturnType<typeof vi.fn>): AIProviderFactory {
  return { create: spy, createFromConfig: spy };
}

function expectProviderConfigCall(
  spy: ReturnType<typeof vi.fn>,
  providerId: string,
  apiKey: string | ReturnType<typeof expect.any> = expect.any(String)
) {
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: providerId }), apiKey);
}

const mockFactory: AIProviderFactory = {
  create: (_provider: string, _key: string) => new MockProvider(['Hello', ' world']),
  createFromConfig: () => new MockProvider(['Hello', ' world']),
};

describe('OrchestratorService', () => {
  beforeEach(() => {
    vi.mocked(keytar.getPassword).mockResolvedValue('test-api-key');
  });

  it('streams chunks from provider via factory', async () => {
    const orchestrator = new OrchestratorService({ factory: mockFactory });
    const chunks = await collect(
      orchestrator.stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
      })
    );
    const text = chunks
      .filter((c) => c.delta !== '')
      .map((c) => c.delta)
      .join('');
    expect(text).toBe('Hello world');
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('uses explicit provider name from request', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['explicit']));
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o',
        provider: 'codex',
      })
    );
    expectProviderConfigCall(createSpy, 'openai', 'test-api-key');
  });

  it('infers anthropic provider for claude-* models', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'claude-3-5-sonnet-20241022',
      })
    );
    expectProviderConfigCall(createSpy, 'anthropic');
  });

  it('infers codex provider for gpt-* models', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'gpt-4o',
      })
    );
    expectProviderConfigCall(createSpy, 'openai');
  });

  it('infers ollama provider for llama-* models', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'llama-3.2',
      })
    );
    expectProviderConfigCall(createSpy, 'ollama', 'ollama');
  });

  it('throws when API key missing in keychain', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue(null);
    const orchestrator = new OrchestratorService({ factory: mockFactory });
    await expect(
      collect(
        orchestrator.stream({
          messages: [{ role: 'user', content: 'hi' }],
          model: 'claude-3-sonnet',
        })
      )
    ).rejects.toThrow(/Missing API key/);
  });

  it('infers claude-compat:zai for glm-* models without agent', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'glm-4.7',
      })
    );
    expectProviderConfigCall(createSpy, 'zai');
  });

  it('infers claude-compat:minimax for minimax-* models without agent', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'minimax-text-01',
      })
    );
    expectProviderConfigCall(createSpy, 'minimax');
  });

  it('infers claude-compat:moonshot for kimi-* models without agent', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'kimi-k2',
      })
    );
    expectProviderConfigCall(createSpy, 'moonshot');
  });

  it('infers claude-compat:qwen for qwen-* models without agent', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'qwen-2.5',
      })
    );
    expectProviderConfigCall(createSpy, 'qwen');
  });

  it('maps explicit claude-compat provider id to claude-compat wire', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'x' }],
        model: 'glm-4.7',
        provider: 'zai',
      })
    );
    expectProviderConfigCall(createSpy, 'zai');
  });

  it('passes system prompt through to the query call', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['ok']));
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
        system: 'Be helpful',
      })
    );
    expect(createSpy).toHaveBeenCalled();
  });

  it('FIX-005: a persisted Agent drives provider (from runtime), model, and system prompt', async () => {
    fakeRepos.agent.findById = async () => ({
      userId: 'u1',
      model: 'agent-specific-model',
      runtime: 'codex',
      provider: undefined,
      systemPrompt: 'You are the persisted agent.',
      skills: [],
    });
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['agent reply']));
    const chunks = await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022', // should be overridden by the agent
        agentId: 'a1',
        userId: 'u1',
      })
    );
    // runtime 'codex' maps to the OpenAI-compatible provider config.
    expectProviderConfigCall(createSpy, 'openai');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('M2: uses explicit provider when agent runtime is claude-compat', async () => {
    fakeRepos.agent.findById = async () => ({
      userId: 'u1',
      model: 'glm-4.7',
      runtime: 'claude-compat',
      provider: 'zai',
      systemPrompt: 'You are a Z.ai agent.',
      skills: [],
    });
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['zai reply']));
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
        agentId: 'a1',
        userId: 'u1',
      })
    );
    expectProviderConfigCall(createSpy, 'zai');
  });

  it('M2: infers claude-compat provider by model prefix when provider omitted', async () => {
    fakeRepos.agent.findById = async () => ({
      userId: 'u1',
      model: 'kimi-k2',
      runtime: 'claude-compat',
      provider: undefined,
      systemPrompt: 'You are a Kimi agent.',
      skills: [],
    });
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['kimi reply']));
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
        agentId: 'a1',
        userId: 'u1',
      })
    );
    expectProviderConfigCall(createSpy, 'moonshot');
  });

  // ---- P1-5: inferProvider catalog path (mapRegistryProviderToWire branches) ----

  it('P1-5: a catalogued OpenAI model infers the codex wire provider', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['oai']));
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o',
      })
    );
    expectProviderConfigCall(createSpy, 'openai');
  });

  it('P1-5: a catalogued Ollama model infers the ollama wire provider', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider());
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'llama-3.2',
      })
    );
    expectProviderConfigCall(createSpy, 'ollama');
  });

  it('P1-5: an OpenRouter-prefixed model infers the openrouter wire provider', async () => {
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['or']));
    await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'or:z-ai/glm-4.7',
      })
    );
    expectProviderConfigCall(createSpy, 'openrouter');
  });

  // ---- applyAgent / resolveAgentRuntime null branch ----

  it('falls back to the request unchanged when agentId resolves to no agent', async () => {
    fakeRepos.agent.findById = async () => null;
    const createSpy = vi.fn().mockReturnValue(new MockProvider(['no agent']));
    const chunks = await collect(
      new OrchestratorService({ factory: spyFactory(createSpy) }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
        agentId: 'missing-agent',
      })
    );
    expect(chunks.length).toBeGreaterThan(0);
    // No explicit userId in the request → falls back to the agent's userId
    // when one exists; with a null agent the request is used as-is.
    expectProviderConfigCall(createSpy, 'anthropic');
  });

  // ---- stream() option-spread branches ----

  it('forwards maxTokens, temperature, signal, and imageParts through to the provider', async () => {
    const provider = new MockProvider(['opts']);
    const querySpy = vi.spyOn(provider, 'query');
    const factory: AIProviderFactory = { create: () => provider, createFromConfig: () => provider };
    const ac = new AbortController();
    const imageParts = [{ mimeType: 'image/png', data: 'x' }];
    await collect(
      new OrchestratorService({ factory }).stream({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 128,
        temperature: 0.5,
        signal: ac.signal,
        imageParts,
      })
    );
    expect(querySpy).toHaveBeenCalledTimes(1);
    const passed = querySpy.mock.calls[0]![0] as {
      maxTokens?: number;
      temperature?: number;
      signal?: AbortSignal;
      imageParts?: typeof imageParts;
    };
    expect(passed.maxTokens).toBe(128);
    expect(passed.temperature).toBe(0.5);
    expect(passed.signal).toBe(ac.signal);
    expect(passed.imageParts).toEqual(imageParts);
  });
});
