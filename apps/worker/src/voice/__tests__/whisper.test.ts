import { afterEach, describe, expect, it, vi } from 'vitest';

import { WhisperSttProvider } from '../whisper';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', () => ({ spawn: spawnMock }));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env['WHISPER_BIN_PATH'];
});

function makeSpawnEmitter(jsonOutput: string, exitCode = 0) {
  spawnMock.mockImplementation(() => ({
    stdout: {
      on: (event: string, handler: (d: Buffer) => void) => {
        if (event === 'data') setImmediate(() => handler(Buffer.from(jsonOutput)));
      },
    },
    stderr: { on: vi.fn() },
    on: (event: string, handler: (code: number) => void) => {
      if (event === 'close') setImmediate(() => handler(exitCode));
    },
  }));
}

describe('WhisperSttProvider', () => {
  it('uses OpenAI API when no bin path configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new WhisperSttProvider('sk-test');
    const result = await provider.transcribe(Buffer.from('audio'), 'audio/webm');

    expect(result.text).toBe('hello world');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({ method: 'POST' })
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('uses local subprocess when WHISPER_BIN_PATH is set', async () => {
    process.env['WHISPER_BIN_PATH'] = '/usr/local/bin/whisper-cpp';
    makeSpawnEmitter(JSON.stringify({ text: 'local transcript result' }), 0);

    const provider = new WhisperSttProvider('sk-test');
    const result = await provider.transcribe(Buffer.from('audio'), 'audio/wav');

    expect(result.text).toBe('local transcript result');
    expect(spawnMock).toHaveBeenCalledWith(
      '/usr/local/bin/whisper-cpp',
      expect.arrayContaining(['--output-json']),
      expect.any(Object)
    );
  });

  it('falls back to OpenAI API when subprocess exits with non-zero code', async () => {
    process.env['WHISPER_BIN_PATH'] = '/usr/local/bin/whisper-cpp';
    makeSpawnEmitter('', 1);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'api fallback result' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new WhisperSttProvider('sk-test');
    const result = await provider.transcribe(Buffer.from('audio'), 'audio/wav');

    expect(result.text).toBe('api fallback result');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('falls back to OpenAI API when subprocess output is invalid JSON', async () => {
    process.env['WHISPER_BIN_PATH'] = '/usr/local/bin/whisper-cpp';
    makeSpawnEmitter('invalid json!!!', 0);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'api fallback' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new WhisperSttProvider('sk-test');
    const result = await provider.transcribe(Buffer.from('audio'), 'audio/wav');

    expect(result.text).toBe('api fallback');
  });

  it('includes durationMs in result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hi' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new WhisperSttProvider('sk-test');
    const result = await provider.transcribe(Buffer.from('audio'), 'audio/webm');

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws when API responds with error and no local fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new WhisperSttProvider('sk-bad');
    await expect(provider.transcribe(Buffer.from('audio'), 'audio/webm')).rejects.toThrow(/401/);
  });
});
