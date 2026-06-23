import { describe, expect, it } from 'vitest';

import { UPLOAD_MAX_BYTES, UPLOAD_MIME_ALLOWLIST, processUploadedFile } from '../chat-upload';

describe('processUploadedFile', () => {
  it('converts ArrayBuffer to base64 data URL payload', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG magic bytes
    const result = processUploadedFile('icon.png', 'image/png', buf);
    expect(result.filename).toBe('icon.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBe(4);
    expect(typeof result.data).toBe('string');
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('throws when file exceeds MAX_BYTES', () => {
    const buf = new ArrayBuffer(UPLOAD_MAX_BYTES + 1);
    expect(() => processUploadedFile('big.pdf', 'application/pdf', buf)).toThrow('5 MB');
  });

  it('throws when MIME type not in allowlist', () => {
    const buf = new ArrayBuffer(100);
    expect(() => processUploadedFile('clip.mp4', 'video/mp4', buf)).toThrow('não suportado');
  });

  it('accepts all types in UPLOAD_MIME_ALLOWLIST', () => {
    const buf = new ArrayBuffer(10);
    for (const mime of UPLOAD_MIME_ALLOWLIST) {
      expect(() => processUploadedFile('file', mime, buf)).not.toThrow();
    }
  });
});
