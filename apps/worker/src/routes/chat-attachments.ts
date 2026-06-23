import { parseByMimeType } from '../knowledge/parsers/index';

export interface AttachmentInput {
  filename: string;
  mimeType: string;
  data: string; // base64
}

export interface ImagePart {
  mimeType: string;
  data: string;
}

export interface ProcessedAttachments {
  content: string;
  imageParts: ImagePart[];
}

export async function processAttachments(
  message: string,
  attachments: AttachmentInput[] | undefined,
): Promise<ProcessedAttachments> {
  if (!attachments?.length) return { content: message, imageParts: [] };

  const imageParts: ImagePart[] = [];
  let docText = '';

  for (const att of attachments) {
    if (att.mimeType.startsWith('image/')) {
      imageParts.push({ mimeType: att.mimeType, data: att.data });
    } else {
      const buffer = Buffer.from(att.data, 'base64');
      const parsed = await parseByMimeType(buffer, att.mimeType, att.filename);
      docText += `\n\n[Attached: ${att.filename}]\n${parsed.text}`;
    }
  }

  return { content: message + docText, imageParts };
}
