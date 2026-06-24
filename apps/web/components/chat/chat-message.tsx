'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { ArtifactPayload } from './sse';
import type { ToolCall } from './tool-call-inline';
import { ToolCallInline } from './tool-call-inline';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface DisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  artifacts?: ArtifactPayload[];
  createdAt: Date;
}

const markdownComponents = {
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted my-2 overflow-x-auto rounded-md p-3 text-xs font-mono">{children}</pre>
  ),
};

function ArtifactInline({ artifact }: { artifact: ArtifactPayload }) {
  if (artifact.type === 'image' && typeof artifact.data['imageBase64'] === 'string' && typeof artifact.data['mimeType'] === 'string') {
    const b64 = artifact.data['imageBase64'];
    const mime = artifact.data['mimeType'];
    return (
      <div className="mt-2 rounded-md border bg-card p-2">
        {artifact.title && <div className="mb-1 text-xs font-medium text-muted-foreground">{artifact.title}</div>}
        <img src={`data:${mime};base64,${b64}`} alt={artifact.title ?? 'Generated image'} className="max-w-full rounded" />
      </div>
    );
  }
  if (artifact.type === 'audio' && typeof artifact.data['audioBase64'] === 'string') {
    const b64 = artifact.data['audioBase64'];
    const mime = artifact.data['mimeType'] ?? 'audio/mpeg';
    return (
      <div className="mt-2 rounded-md border bg-card p-2">
        {artifact.title && <div className="mb-1 text-xs font-medium text-muted-foreground">{artifact.title}</div>}
        <audio controls src={`data:${mime};base64,${b64}`} className="w-full" />
      </div>
    );
  }
  if (artifact.type === 'mcp_app' && typeof artifact.data['excalidrawFile'] === 'string') {
    const file = artifact.data['excalidrawFile'];
    return (
      <div className="mt-2 rounded-md border bg-card p-2">
        {artifact.title && <div className="mb-1 text-xs font-medium text-muted-foreground">{artifact.title}</div>}
        <a
          href={`https://excalidraw.com/#json=${btoa(file)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open in Excalidraw
        </a>
      </div>
    );
  }
  return null;
}

interface Props { message: DisplayMessage; }

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <div data-role={message.role} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        )}
        {message.toolCalls?.map((tc) => <ToolCallInline key={tc.id} toolCall={tc} />)}
        {message.artifacts?.map((a) => <ArtifactInline key={a.id} artifact={a} />)}
      </div>
    </div>
  );
}
