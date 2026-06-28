/**
 * POST /api/chat/upload — receive multipart file, return base64 attachment data.
 * validates size (≤5 MB) and MIME type before returning AttachmentData.
 */

import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { processUploadedFile } from '@/lib/chat-upload';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const files = formData.getAll('file') as File[];
  if (!files.length) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const attachments = [];
  for (const file of files) {
    let attachment;
    try {
      const buf = await file.arrayBuffer();
      attachment = processUploadedFile(file.name, file.type, buf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload error';
      return Response.json({ error: msg }, { status: 422 });
    }
    attachments.push(attachment);
  }

  return Response.json({ attachments });
}
