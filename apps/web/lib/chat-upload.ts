export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20 MB (F3.6)

export const UPLOAD_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;

type AllowedMime = (typeof UPLOAD_MIME_ALLOWLIST)[number];

function isAllowed(mime: string): mime is AllowedMime {
  return (UPLOAD_MIME_ALLOWLIST as readonly string[]).includes(mime);
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface UploadedAttachment {
  filename: string;
  mimeType: string;
  size: number;
  data: string; // base64
}

export function processUploadedFile(
  filename: string,
  mimeType: string,
  buf: ArrayBuffer
): UploadedAttachment {
  if (buf.byteLength > UPLOAD_MAX_BYTES) {
    throw new Error(`Arquivo excede o limite de 20 MB.`);
  }
  if (!isAllowed(mimeType)) {
    throw new Error(`Tipo "${mimeType}" não suportado.`);
  }
  return { filename, mimeType, size: buf.byteLength, data: bufferToBase64(buf) };
}
