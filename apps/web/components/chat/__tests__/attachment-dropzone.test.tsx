import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AttachmentDropzone } from '../attachment-dropzone';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function makeFile(name: string, type: string, size = 100): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('AttachmentDropzone', () => {
  it('renders drop label', () => {
    render(<AttachmentDropzone onAttach={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByTestId('attachment-dropzone')).toBeTruthy();
  });

  it('accepts image/png file and calls onAttach', async () => {
    const onAttach = vi.fn();
    const { container } = render(<AttachmentDropzone onAttach={onAttach} onError={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('photo.png', 'image/png');
    await userEvent.upload(input, file);
    expect(onAttach).toHaveBeenCalledOnce();
    const [arg] = onAttach.mock.calls[0] as [
      { filename: string; mimeType: string; data: string }[],
    ];
    expect(arg[0]?.filename).toBe('photo.png');
    expect(arg[0]?.mimeType).toBe('image/png');
    expect(typeof arg[0]?.data).toBe('string');
  });

  it('accepts application/pdf file and calls onAttach', async () => {
    const onAttach = vi.fn();
    const { container } = render(<AttachmentDropzone onAttach={onAttach} onError={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('report.pdf', 'application/pdf');
    await userEvent.upload(input, file);
    expect(onAttach).toHaveBeenCalledOnce();
  });

  it('accepts text/plain file', async () => {
    const onAttach = vi.fn();
    const { container } = render(<AttachmentDropzone onAttach={onAttach} onError={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('main.py', 'text/plain');
    await userEvent.upload(input, file);
    expect(onAttach).toHaveBeenCalledOnce();
  });

  it('rejects file exceeding 5 MB limit and calls onError', async () => {
    const onError = vi.fn();
    const { container } = render(<AttachmentDropzone onAttach={vi.fn()} onError={onError} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('big.png', 'image/png', MAX_BYTES + 1);
    await userEvent.upload(input, file);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('5 MB'));
  });

  it('rejects unsupported MIME type and calls onError', async () => {
    const onError = vi.fn();
    const { container } = render(<AttachmentDropzone onAttach={vi.fn()} onError={onError} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('video.mp4', 'video/mp4');
    await userEvent.upload(input, file);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('não suportado'));
  });
});
