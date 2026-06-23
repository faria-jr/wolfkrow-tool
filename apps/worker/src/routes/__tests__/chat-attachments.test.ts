/**
 * Tests: T21 — processAttachments (image→imageParts, docs→text extraction)
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../knowledge/parsers/index', () => ({
  parseByMimeType: vi.fn(),
}));

import { parseByMimeType } from '../../knowledge/parsers/index';
import { processAttachments } from '../chat-attachments';

const mockParse = parseByMimeType as ReturnType<typeof vi.fn>;

describe('processAttachments', () => {
  it('returns original message and empty imageParts when no attachments', async () => {
    const result = await processAttachments('hello', []);
    expect(result).toEqual({ content: 'hello', imageParts: [] });
  });

  it('returns original message and empty imageParts when attachments is undefined', async () => {
    const result = await processAttachments('hello', undefined);
    expect(result).toEqual({ content: 'hello', imageParts: [] });
  });

  it('extracts image into imageParts, keeps message unchanged', async () => {
    const result = await processAttachments('look at this', [
      { filename: 'photo.jpg', mimeType: 'image/jpeg', data: 'abc123' },
    ]);
    expect(result.imageParts).toEqual([{ mimeType: 'image/jpeg', data: 'abc123' }]);
    expect(result.content).toBe('look at this');
  });

  it('handles multiple images', async () => {
    const result = await processAttachments('images', [
      { filename: 'a.png', mimeType: 'image/png', data: 'data1' },
      { filename: 'b.gif', mimeType: 'image/gif', data: 'data2' },
    ]);
    expect(result.imageParts).toHaveLength(2);
    expect(result.imageParts[0]).toEqual({ mimeType: 'image/png', data: 'data1' });
    expect(result.imageParts[1]).toEqual({ mimeType: 'image/gif', data: 'data2' });
  });

  it('parses PDF and appends extracted text to message', async () => {
    mockParse.mockResolvedValueOnce({ text: 'PDF content here', title: 'Doc' });
    const result = await processAttachments('summarize this', [
      { filename: 'report.pdf', mimeType: 'application/pdf', data: 'cGRmZGF0YQ==' },
    ]);
    expect(mockParse).toHaveBeenCalledWith(
      Buffer.from('cGRmZGF0YQ==', 'base64'),
      'application/pdf',
      'report.pdf',
    );
    expect(result.imageParts).toEqual([]);
    expect(result.content).toContain('summarize this');
    expect(result.content).toContain('[Attached: report.pdf]');
    expect(result.content).toContain('PDF content here');
  });

  it('handles mixed image + doc attachments', async () => {
    mockParse.mockResolvedValueOnce({ text: 'code content', title: undefined });
    const result = await processAttachments('explain this', [
      { filename: 'photo.jpg', mimeType: 'image/jpeg', data: 'img64' },
      { filename: 'main.py', mimeType: 'text/plain', data: 'Y29kZQ==' },
    ]);
    expect(result.imageParts).toHaveLength(1);
    expect(result.imageParts[0]?.mimeType).toBe('image/jpeg');
    expect(result.content).toContain('explain this');
    expect(result.content).toContain('[Attached: main.py]');
    expect(result.content).toContain('code content');
  });
});
