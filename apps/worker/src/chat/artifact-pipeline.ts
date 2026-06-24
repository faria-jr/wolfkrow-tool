import type { Artifact } from '@wolfkrow/domain';
import { ArtifactDetector } from '@wolfkrow/infra';

export interface ArtifactPipelineDeps {
  detector: ArtifactDetector;
}

export function createArtifactPipeline(deps?: ArtifactPipelineDeps) {
  const detector = deps?.detector ?? new ArtifactDetector();
  const toolInputs = new Map<string, { name: string; input: Record<string, unknown> }>();

  function registerToolCall(id: string, name: string, input: Record<string, unknown>): void {
    toolInputs.set(id, { name, input });
  }

  function detectArtifact(callId: string, output: unknown, isError: boolean): Artifact | null {
    if (isError) return null;
    const toolInfo = toolInputs.get(callId);
    if (!toolInfo) return null;
    return detector.detect(toolInfo.name, toolInfo.input, {
      output: output as string,
      isError,
      toolUseId: callId,
    });
  }

  return { registerToolCall, detectArtifact };
}

export type ArtifactPipeline = ReturnType<typeof createArtifactPipeline>;
