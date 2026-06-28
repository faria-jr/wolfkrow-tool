import { randomUUID } from 'node:crypto';

import { Artifact, type ArtifactData } from '@wolfkrow/domain';

import { asRecord, findAudioInContent, readAudioAsBase64 } from './artifact-detector-helpers';
import {
  buildExcalidrawFile,
  extractElements,
  isExcalidrawTool,
} from './artifact-excalidraw-helpers';
import { findImageInContent, findInlineImage, readImageAsBase64 } from './artifact-image-helpers';

export interface ArtifactDetectionResult {
  artifact: Artifact | null;
  /** True if the result was discarded due to an error (image file unreadable, etc.). */
  attempted: boolean;
}

function resolveMcpTool(
  toolName: string,
  input: Record<string, unknown>
): { toolName: string; input: Record<string, unknown> } {
  if (toolName === 'mcp_call') {
    const serverId = typeof input['server_id'] === 'string' ? input['server_id'] : '';
    const tool = typeof input['tool'] === 'string' ? input['tool'] : '';
    const args = asRecord(input['args']);
    if (serverId && tool && args) {
      return { toolName: `mcp:${serverId}.${tool}`, input: args };
    }
    return { toolName, input };
  }
  if (toolName.startsWith('mcp:')) {
    const args = asRecord(input['args']);
    return args ? { toolName, input: args } : { toolName, input };
  }
  return { toolName, input };
}

function createImageArtifact(match: {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  title?: string;
  toolName: string;
}): Artifact {
  const data: ArtifactData = {
    imageBase64: match.imageBase64,
    mimeType: match.mimeType,
    prompt: match.prompt,
  };
  return Artifact.create({
    id: randomUUID(),
    type: 'image',
    toolName: match.toolName,
    title: match.title ?? `Imagem: ${match.prompt.slice(0, 50)}`,
    data,
  });
}

function createFileImageArtifact(
  image: { imagePath: string; title?: string },
  content: string
): Artifact | null {
  const buf = readImageAsBase64(image.imagePath);
  if (!buf) return null;
  const promptMatch = content.match(/Prompt:\s*(.+?)(?:\n|\\n|$)/);
  const prompt = promptMatch?.[1]?.trim() ?? image.title ?? 'Imagem gerada';
  const data: ArtifactData = {
    imageBase64: buf.base64,
    mimeType: buf.mime,
    prompt,
    filePath: image.imagePath,
  };
  return Artifact.create({
    id: randomUUID(),
    type: 'image',
    toolName: 'nano-banana',
    title: image.title ?? `Imagem: ${prompt.slice(0, 50)}`,
    data,
  });
}

function createAudioArtifact(audio: { audioPath: string; mimeType: string }): Artifact | null {
  const base64 = readAudioAsBase64(audio.audioPath);
  if (!base64) return null;
  const data: ArtifactData = {
    audioBase64: base64,
    mimeType: audio.mimeType,
    filePath: audio.audioPath,
  };
  return Artifact.create({
    id: randomUUID(),
    type: 'audio',
    toolName: 'elevenlabs',
    title: 'Audio gerado',
    data,
  });
}

export class ArtifactDetector {
  /**
   * Inspect a tool_use event (input only) for excalidraw artifacts.
   * Returns null for non-excalidraw tools.
   */
  detectFromToolUse(
    _toolUseId: string,
    toolName: string,
    input: Record<string, unknown>
  ): Artifact | null {
    const resolved = resolveMcpTool(toolName, input);
    if (!isExcalidrawTool(resolved.toolName)) return null;
    const extracted = extractElements(resolved.input);
    if (!extracted) return null;

    const viewId = randomUUID();
    const excalidrawFile = buildExcalidrawFile(extracted.elements, extracted.appState);
    const data: ArtifactData = { viewId, excalidrawFile };
    return Artifact.create({
      id: viewId,
      type: 'mcp_app',
      toolName: resolved.toolName,
      title: extracted.title,
      data,
    });
  }

  /**
   * Inspect a tool_result event (output content) for image/audio artifacts.
   * Returns null when nothing artifact-worthy is present.
   */
  detectFromToolResult(
    _toolUseId: string,
    content: string,
    isError: boolean
  ): ArtifactDetectionResult {
    if (isError) return { artifact: null, attempted: false };

    const inline = findInlineImage(content);
    if (inline) {
      return { artifact: createImageArtifact(inline), attempted: true };
    }

    const image = findImageInContent(content);
    if (image) {
      const artifact = createFileImageArtifact(image, content);
      if (artifact) return { artifact, attempted: true };
    }

    const audio = findAudioInContent(content);
    if (audio) {
      const artifact = createAudioArtifact(audio);
      if (artifact) return { artifact, attempted: true };
    }

    return { artifact: null, attempted: false };
  }

  /**
   * Convenience: full detect call combining tool_use + tool_result.
   */
  detect(
    toolName: string,
    input: Record<string, unknown>,
    result: { output: string | null; isError: boolean; toolUseId?: string }
  ): Artifact | null {
    const toolUseId = result.toolUseId ?? randomUUID();
    const fromUse = this.detectFromToolUse(toolUseId, toolName, input);
    if (fromUse) return fromUse;
    if (result.output === null) return null;
    return this.detectFromToolResult(toolUseId, result.output, result.isError).artifact;
  }
}
