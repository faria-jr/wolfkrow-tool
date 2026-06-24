import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

import { Artifact, type ArtifactData } from '@wolfkrow/domain';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function cleanPathCandidate(raw: string): string {
  let candidate = raw.trim();
  candidate = candidate.replace(/^["'`<]+/, '').replace(/[>"'`]+$/, '');
  candidate = candidate.replace(/[),.;:]+$/, '');
  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

function isSupportedImagePath(candidate: string): boolean {
  return IMAGE_EXTS.has(extname(candidate).toLowerCase());
}

function existingImagePath(raw: string): string | null {
  const candidate = cleanPathCandidate(raw);
  if (!isSupportedImagePath(candidate)) return null;
  try {
    const stat = statSync(candidate);
    return stat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function findImageInContent(content: string): { imagePath: string; title?: string } | null {
  const explicit = content.match(/ARQUIVO_IMAGEM:\s*((?:\/|[A-Za-z]:\\).+?)(?:\n|\\n|$)/);
  if (explicit && explicit[1]) {
    const imagePath = existingImagePath(explicit[1]);
    if (imagePath) return { imagePath };
  }

  const markdownImages = content.matchAll(/!\[([^\]]*)]\(((?:\/|[A-Za-z]:\\)[^)]+)\)/g);
  for (const match of markdownImages) {
    if (!match[2]) continue;
    const imagePath = existingImagePath(match[2]);
    if (imagePath) {
      const title = match[1]?.trim();
      return title ? { imagePath, title } : { imagePath };
    }
  }

  const labelled = content.matchAll(/(?:Arquivo|Imagem|Image|File):\s*((?:\/|[A-Za-z]:\\).+?\.(?:png|jpe?g|webp|gif))(?:\s|\\n|\n|$)/gi);
  for (const match of labelled) {
    if (!match[1]) continue;
    const imagePath = existingImagePath(match[1]);
    if (imagePath) return { imagePath };
  }

  const barePaths = content.matchAll(/((?:\/|[A-Za-z]:\\)[^\n\r"'`<>]+?\.(?:png|jpe?g|webp|gif))(?:[\s).,;]|$)/gi);
  for (const match of barePaths) {
    if (!match[1]) continue;
    const imagePath = existingImagePath(match[1]);
    if (imagePath) return { imagePath };
  }

  return null;
}

function mimeTypeFromPath(p: string): string {
  const ext = extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function readImageAsBase64(p: string): { base64: string; mime: string } | null {
  try {
    const buf = readFileSync(p);
    return { base64: buf.toString('base64'), mime: mimeTypeFromPath(p) };
  } catch {
    return null;
  }
}

function isExcalidrawTool(name: string): boolean {
  const lower = name.toLowerCase();
  if (!lower.includes('excalidraw')) return false;
  return (
    lower.endsWith('create_view') ||
    lower.endsWith('export_to_excalidraw') ||
    lower.endsWith('save_checkpoint')
  );
}

function extractElements(input: Record<string, unknown>): {
  elements: unknown[];
  appState: Record<string, unknown>;
  title: string;
} | null {
  let rawElements: unknown[] | null = null;
  let appState: Record<string, unknown> = {};

  if (Array.isArray(input['elements'])) {
    rawElements = input['elements'] as unknown[];
    if (input['appState'] && typeof input['appState'] === 'object') {
      appState = input['appState'] as Record<string, unknown>;
    }
  } else if (typeof input['elements'] === 'string') {
    try {
      const parsed: unknown = JSON.parse(input['elements']);
      if (Array.isArray(parsed)) rawElements = parsed;
    } catch { /* ignore */ }
  } else if (typeof input['content'] === 'string') {
    try {
      const parsed: unknown = JSON.parse(input['content']);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj['elements'])) {
          rawElements = obj['elements'] as unknown[];
          if (obj['appState'] && typeof obj['appState'] === 'object') {
            appState = obj['appState'] as Record<string, unknown>;
          }
        }
      } else if (Array.isArray(parsed)) {
        rawElements = parsed;
      }
    } catch { /* ignore */ }
  } else if (Array.isArray(input['content'])) {
    rawElements = input['content'] as unknown[];
  }

  if (!rawElements || rawElements.length === 0) return null;
  const title = (typeof input['title'] === 'string' ? input['title'] : undefined) ??
    (typeof input['name'] === 'string' ? input['name'] : undefined) ??
    'Excalidraw';
  return { elements: rawElements, appState, title };
}

function buildExcalidrawFile(elements: unknown[], appState: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'wolfkrow',
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: '#ffffff',
      ...appState,
    },
    files: {},
  }, null, 2);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeBase64Image(raw: string): { imageBase64: string; mimeType: string } | null {
  const trimmed = raw.trim();
  const dataUrl = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (dataUrl && dataUrl[1] && dataUrl[2]) {
    return {
      mimeType: dataUrl[1].toLowerCase(),
      imageBase64: dataUrl[2].replace(/\s+/g, ''),
    };
  }
  const compact = trimmed.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return null;
  if (compact.startsWith('iVBORw0KGgo')) return { imageBase64: compact, mimeType: 'image/png' };
  if (compact.startsWith('/9j/')) return { imageBase64: compact, mimeType: 'image/jpeg' };
  if (compact.startsWith('UklGR')) return { imageBase64: compact, mimeType: 'image/webp' };
  if (compact.startsWith('R0lGOD')) return { imageBase64: compact, mimeType: 'image/gif' };
  return null;
}

interface InlineImageMatch {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  title?: string;
  toolName: string;
}

function findInlineImage(content: string): InlineImageMatch | null {
  const raw = normalizeBase64Image(content);
  if (raw) {
    return {
      imageBase64: raw.imageBase64,
      mimeType: raw.mimeType,
      prompt: 'Imagem gerada',
      toolName: 'image-generation',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const record = asRecord(parsed);
  const data = asRecord(record?.['data']);
  const imageRaw =
    firstString(record, ['imageBase64', 'image_base64', 'b64_json', 'result', 'image']) ??
    firstString(data, ['imageBase64', 'image_base64', 'b64_json', 'result', 'image']);
  if (!imageRaw) return null;

  const image = normalizeBase64Image(imageRaw);
  if (!image) return null;

  const prompt =
    firstString(record, ['prompt', 'revised_prompt', 'revisedPrompt']) ??
    firstString(data, ['prompt', 'revised_prompt', 'revisedPrompt']) ??
    'Imagem gerada';
  const title = firstString(record, ['title']) ?? firstString(data, ['title']);
  const toolName =
    firstString(record, ['toolName', 'tool_name']) ??
    firstString(data, ['toolName', 'tool_name']) ??
    'image-generation';
  const mimeType =
    firstString(record, ['mimeType', 'mime_type']) ??
    firstString(data, ['mimeType', 'mime_type']) ??
    image.mimeType;

  return {
    imageBase64: image.imageBase64,
    mimeType,
    prompt,
    ...(title !== undefined ? { title } : {}),
    toolName,
  };
}

function findAudioInContent(content: string): { audioPath: string; mimeType: string } | null {
  const audioMatch = content.match(/ARQUIVO_AUDIO:\s*((?:\/|[A-Za-z]:\\).+?)(?:\n|$)/);
  if (!audioMatch || !audioMatch[1]) return null;
  const audioPath = audioMatch[1].trim();
  try {
    const stat = statSync(audioPath);
    if (!stat.isFile()) return null;
    return { audioPath, mimeType: 'audio/mpeg' };
  } catch {
    return null;
  }
}

function readAudioAsBase64(p: string): string | null {
  try {
    return readFileSync(p).toString('base64');
  } catch {
    return null;
  }
}

export interface ArtifactDetectionResult {
  artifact: Artifact | null;
  /** True if the result was discarded due to an error (image file unreadable, etc.). */
  attempted: boolean;
}

export class ArtifactDetector {
  /**
   * Inspect a tool_use event (input only) for excalidraw artifacts.
   * Returns null for non-excalidraw tools.
   */
  detectFromToolUse(
    _toolUseId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Artifact | null {
    let effectiveToolName = toolName;
    let effectiveInput = input;
    if (toolName === 'mcp_call') {
      const serverId = typeof input['server_id'] === 'string' ? input['server_id'] : '';
      const tool = typeof input['tool'] === 'string' ? input['tool'] : '';
      const args = asRecord(input['args']);
      if (serverId && tool && args) {
        effectiveToolName = `mcp:${serverId}.${tool}`;
        effectiveInput = args;
      }
    } else if (toolName.startsWith('mcp:')) {
      const args = asRecord(input['args']);
      if (args) effectiveInput = args;
    }

    if (!isExcalidrawTool(effectiveToolName)) return null;
    const extracted = extractElements(effectiveInput);
    if (!extracted) return null;

    const viewId = randomUUID();
    const excalidrawFile = buildExcalidrawFile(extracted.elements, extracted.appState);
    const data: ArtifactData = { viewId, excalidrawFile };
    return Artifact.create({
      id: viewId,
      type: 'mcp_app',
      toolName: effectiveToolName,
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
    isError: boolean,
  ): ArtifactDetectionResult {
    if (isError) return { artifact: null, attempted: false };

    const inline = findInlineImage(content);
    if (inline) {
      const data: ArtifactData = {
        imageBase64: inline.imageBase64,
        mimeType: inline.mimeType,
        prompt: inline.prompt,
      };
      const artifact = Artifact.create({
        id: randomUUID(),
        type: 'image',
        toolName: inline.toolName,
        title: inline.title ?? `Imagem: ${inline.prompt.slice(0, 50)}`,
        data,
      });
      return { artifact, attempted: true };
    }

    const image = findImageInContent(content);
    if (image) {
      const buf = readImageAsBase64(image.imagePath);
      if (buf) {
        const promptMatch = content.match(/Prompt:\s*(.+?)(?:\n|\\n|$)/);
        const prompt = promptMatch?.[1]?.trim() ?? image.title ?? 'Imagem gerada';
        const data: ArtifactData = {
          imageBase64: buf.base64,
          mimeType: buf.mime,
          prompt,
          filePath: image.imagePath,
        };
        const artifact = Artifact.create({
          id: randomUUID(),
          type: 'image',
          toolName: 'nano-banana',
          title: image.title ?? `Imagem: ${prompt.slice(0, 50)}`,
          data,
        });
        return { artifact, attempted: true };
      }
    }

    const audio = findAudioInContent(content);
    if (audio) {
      const base64 = readAudioAsBase64(audio.audioPath);
      if (base64) {
        const data: ArtifactData = {
          audioBase64: base64,
          mimeType: audio.mimeType,
          filePath: audio.audioPath,
        };
        const artifact = Artifact.create({
          id: randomUUID(),
          type: 'audio',
          toolName: 'elevenlabs',
          title: 'Audio gerado',
          data,
        });
        return { artifact, attempted: true };
      }
    }

    return { artifact: null, attempted: false };
  }

  /**
   * Convenience: full detect call combining tool_use + tool_result.
   */
  detect(
    toolName: string,
    input: Record<string, unknown>,
    output: string | null,
    isError: boolean,
    toolUseId: string = randomUUID(),
  ): Artifact | null {
    const fromUse = this.detectFromToolUse(toolUseId, toolName, input);
    if (fromUse) return fromUse;
    if (output === null) return null;
    return this.detectFromToolResult(toolUseId, output, isError).artifact;
  }
}
