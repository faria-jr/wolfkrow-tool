import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadDropZone } from '../upload-dropzone';

describe('UploadDropZone', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders upload instructions', () => {
    render(<UploadDropZone onUploaded={vi.fn()} />);
    expect(screen.getByText(/drag files here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
  });

  it('uploads selected file via input change', async () => {
    const onUploaded = vi.fn();
    render(<UploadDropZone onUploaded={onUploaded} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });
    await userEvent.upload(input, file);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalled());
  });

  it('shows error when upload fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Too big' }),
    } as Response);
    render(<UploadDropZone onUploaded={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['d'], 't.txt', { type: 'text/plain' }));
    expect(await screen.findByText('Too big')).toBeInTheDocument();
  });
});
