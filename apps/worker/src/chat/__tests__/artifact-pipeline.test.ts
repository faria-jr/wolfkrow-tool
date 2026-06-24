import { describe, expect, it, vi } from 'vitest';

import { createArtifactPipeline } from '../artifact-pipeline';

vi.mock('@wolfkrow/infra', () => ({
  ArtifactDetector: class {
    detect(toolName: string, _input: unknown, result: { output: string | null }) {
      if (toolName === 'excalidraw') return { toJSON: () => ({ type: 'excalidraw', payload: result.output }) };
      return null;
    }
  },
}));

describe('artifact pipeline', () => {
  it('returns null when no tool call was registered', () => {
    const pipeline = createArtifactPipeline();
    expect(pipeline.detectArtifact('cid', 'output', false)).toBeNull();
  });

  it('returns null on tool error', () => {
    const pipeline = createArtifactPipeline();
    pipeline.registerToolCall('cid', 'excalidraw', {});
    expect(pipeline.detectArtifact('cid', 'output', true)).toBeNull();
  });

  it('detects artifact after tool call registration', () => {
    const pipeline = createArtifactPipeline();
    pipeline.registerToolCall('cid', 'excalidraw', { prompt: 'x' });
    const artifact = pipeline.detectArtifact('cid', '{"x":1}', false);
    expect(artifact).not.toBeNull();
    expect(artifact?.toJSON()).toEqual({ type: 'excalidraw', payload: '{"x":1}' });
  });
});
