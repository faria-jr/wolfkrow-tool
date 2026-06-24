import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ArtifactDetector } from '../artifact-detector';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'artifact-detector-'));
}

function makeImage(dir: string, name = 'cat.png'): string {
  // 1x1 transparent PNG (89 bytes).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );
  const p = join(dir, name);
  writeFileSync(p, png);
  return p;
}

describe('ArtifactDetector — excalidraw', () => {
  it('returns null for non-excalidraw tools', () => {
    const det = new ArtifactDetector();
    const a = det.detectFromToolUse('t1', 'bash', { command: 'ls' });
    expect(a).toBeNull();
  });

  it('detects excalidraw create_view with elements', () => {
    const det = new ArtifactDetector();
    const a = det.detectFromToolUse('t1', 'mcp:excalidraw.create_view', {
      elements: [{ type: 'rectangle', x: 0, y: 0 }],
      title: 'My Diagram',
    });
    expect(a).not.toBeNull();
    expect(a!.type).toBe('mcp_app');
    expect(a!.title).toBe('My Diagram');
    expect(a!.data['excalidrawFile']).toBeDefined();
  });

  it('parses stringified elements JSON', () => {
    const det = new ArtifactDetector();
    const a = det.detectFromToolUse('t1', 'excalidraw.create_view', {
      content: JSON.stringify({ elements: [{ type: 'ellipse' }], appState: { foo: 'bar' } }),
      title: 'OK',
    });
    expect(a).not.toBeNull();
    expect(a!.type).toBe('mcp_app');
  });

  it('returns null when no elements can be extracted', () => {
    const det = new ArtifactDetector();
    const a = det.detectFromToolUse('t1', 'excalidraw.create_view', { unrelated: 'data' });
    expect(a).toBeNull();
  });

  it('unwraps mcp_call args', () => {
    const det = new ArtifactDetector();
    const a = det.detectFromToolUse('t1', 'mcp_call', {
      server_id: 'excalidraw',
      tool: 'create_view',
      args: { elements: [{ type: 'arrow' }], title: 'Wrapped' },
    });
    expect(a).not.toBeNull();
    expect(a!.toolName).toBe('mcp:excalidraw.create_view');
  });
});

describe('ArtifactDetector — image artifacts', () => {
  it('returns null on tool errors', () => {
    const det = new ArtifactDetector();
    const out = det.detectFromToolResult('t1', 'something failed', true);
    expect(out.artifact).toBeNull();
  });

  it('detects inline base64 PNG', () => {
    const det = new ArtifactDetector();
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const out = det.detectFromToolResult('t1', b64, false);
    expect(out.artifact).not.toBeNull();
    expect(out.artifact!.type).toBe('image');
    expect(out.artifact!.data['mimeType']).toBe('image/png');
  });

  it('detects existing image path on disk via ARQUIVO_IMAGEM', () => {
    const dir = makeTmpDir();
    try {
      const path = makeImage(dir);
      const det = new ArtifactDetector();
      const out = det.detectFromToolResult('t1', `Prompt: a cat\nARQUIVO_IMAGEM: ${path}\n`, false);
      expect(out.artifact).not.toBeNull();
      expect(out.artifact!.type).toBe('image');
      expect(out.artifact!.data['filePath']).toBe(path);
      expect(typeof out.artifact!.data['imageBase64']).toBe('string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects image via markdown image syntax', () => {
    const dir = makeTmpDir();
    try {
      const path = makeImage(dir, 'photo.png');
      const det = new ArtifactDetector();
      const out = det.detectFromToolResult('t1', `![alt text](${path})`, false);
      expect(out.artifact).not.toBeNull();
      expect(out.artifact!.title).toBe('alt text');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips non-existent image path', () => {
    const det = new ArtifactDetector();
    const out = det.detectFromToolResult('t1', 'ARQUIVO_IMAGEM: /tmp/does-not-exist-1234.png\n', false);
    expect(out.artifact).toBeNull();
  });

  it('parses JSON content with imageBase64', () => {
    const det = new ArtifactDetector();
    const json = JSON.stringify({
      data: {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        prompt: 'test prompt',
      },
    });
    const out = det.detectFromToolResult('t1', json, false);
    expect(out.artifact).not.toBeNull();
    expect(out.artifact!.data['prompt']).toBe('test prompt');
  });
});

describe('ArtifactDetector — audio artifacts', () => {
  it('detects ARQUIVO_AUDIO pointing to existing file', () => {
    const dir = makeTmpDir();
    try {
      const path = join(dir, 'sound.mp3');
      writeFileSync(path, 'fake audio bytes');
      const det = new ArtifactDetector();
      const out = det.detectFromToolResult('t1', `ARQUIVO_AUDIO: ${path}\n`, false);
      expect(out.artifact).not.toBeNull();
      expect(out.artifact!.type).toBe('audio');
      expect(out.artifact!.toolName).toBe('elevenlabs');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ArtifactDetector — combined', () => {
  it('detect() returns excalidraw from tool_use', () => {
    const det = new ArtifactDetector();
    const a = det.detect('excalidraw.create_view', { elements: [{ type: 'line' }] }, { output: null, isError: false });
    expect(a).not.toBeNull();
    expect(a!.type).toBe('mcp_app');
  });

  it('detect() returns null when nothing matches', () => {
    const det = new ArtifactDetector();
    const a = det.detect('bash', { command: 'ls' }, { output: 'file1.txt\nfile2.txt', isError: false });
    expect(a).toBeNull();
  });
});
