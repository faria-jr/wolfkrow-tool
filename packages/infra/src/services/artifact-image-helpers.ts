import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

import { asRecord, firstString } from './artifact-detector-helpers';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export function cleanPathCandidate(raw: string): string {
  let candidate = raw.trim();
  candidate = candidate.replace(/^["'`<]+/, '').replace(/[>"'`]+$/, '');
  candidate = candidate.replace(/[),.;:]+$/, '');
  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

export function isSupportedImagePath(candidate: string): boolean {
  return IMAGE_EXTS.has(extname(candidate).toLowerCase());
}

export function existingImagePath(raw: string): string | null {
  const candidate = cleanPathCandidate(raw);
  if (!isSupportedImagePath(candidate)) return null;
  try {
    const stat = statSync(candidate);
    return stat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function findExplicitImage(content: string): { imagePath: string; title?: string } | null {
  const match = content.match(/ARQUIVO_IMAGEM:\s*((?:\/|[A-Za-z]:\\).+?)(?:\n|\\n|$)/);
  if (!match?.[1]) return null;
  const imagePath = existingImagePath(match[1]);
  return imagePath ? { imagePath } : null;
}

function findMarkdownImage(content: string): { imagePath: string; title?: string } | null {
  const matches = content.matchAll(/!\[([^\]]*)]\(((?:\/|[A-Za-z]:\\)[^)]+)\)/g);
  for (const match of matches) {
    if (!match[2]) continue;
    const imagePath = existingImagePath(match[2]);
    if (imagePath) {
      const title = match[1]?.trim();
      return title ? { imagePath, title } : { imagePath };
    }
  }
  return null;
}

function findLabelledImage(content: string): { imagePath: string; title?: string } | null {
  const matches = content.matchAll(/(?:Arquivo|Imagem|Image|File):\s*((?:\/|[A-Za-z]:\\).+?\.(?:png|jpe?g|webp|gif))(?:\s|\\n|\n|$)/gi);
  for (const match of matches) {
    if (!match[1]) continue;
    const imagePath = existingImagePath(match[1]);
    if (imagePath) return { imagePath };
  }
  return null;
}

function findBareImage(content: string): { imagePath: string; title?: string } | null {
  const matches = content.matchAll(/((?:\/|[A-Za-z]:\\)[^\n\r"'`<>]+?\.(?:png|jpe?g|webp|gif))(?:[\s).,;]|$)/gi);
  for (const match of matches) {
    if (!match[1]) continue;
    const imagePath = existingImagePath(match[1]);
    if (imagePath) return { imagePath };
  }
  return null;
}

export function findImageInContent(content: string): { imagePath: string; title?: string } | null {
  return (
    findExplicitImage(content) ??
    findMarkdownImage(content) ??
    findLabelledImage(content) ??
    findBareImage(content)
  );
}

export function mimeTypeFromPath(p: string): string {
  const ext = extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

export function readImageAsBase64(p: string): { base64: string; mime: string } | null {
  try {
    const buf = readFileSync(p);
    return { base64: buf.toString('base64'), mime: mimeTypeFromPath(p) };
  } catch {
    return null;
  }
}

export function normalizeBase64Image(raw: string): { imageBase64: string; mimeType: string } | null {
  const trimmed = raw.trim();
  const dataUrl = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (dataUrl?.[1] && dataUrl[2]) {
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

export interface InlineImageMatch {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  title?: string;
  toolName: string;
}

function resolveInlineFields(
  record: Record<string, unknown> | null,
  data: Record<string, unknown> | null,
  image: { imageBase64: string; mimeType: string },
): InlineImageMatch {
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

export function findInlineImage(content: string): InlineImageMatch | null {
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

  return resolveInlineFields(record, data, image);
}
