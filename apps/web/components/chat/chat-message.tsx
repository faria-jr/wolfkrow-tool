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

function ImageArtifact({ artifact }: { artifact: ArtifactPayload }) {
  const b64 = artifact.data['imageBase64'];
  const mime = artifact.data['mimeType'];
  if (typeof b64 !== 'string' || typeof mime !== 'string') return null;
  return (
    <div className="mt-2 rounded-md border bg-card p-2">
      {artifact.title && <div className="mb-1 text-xs font-medium text-muted-foreground">{artifact.title}</div>}
      <img src={`data:${mime};base64,${b64}`} alt={artifact.title ?? 'Generated image'} className="max-w-full rounded" />
    </div>
  );
}

function AudioArtifact({ artifact }: { artifact: ArtifactPayload }) {
  const b64 = artifact.data['audioBase64'];
  if (typeof b64 !== 'string') return null;
  const mime = artifact.data['mimeType'] ?? 'audio/mpeg';
  return (
    <div className="mt-2 rounded-md border bg-card p-2">
      {artifact.title && <div className="mb-1 text-xs font-medium text-muted-foreground">{artifact.title}</div>}
      <audio controls src={`data:${mime};base64,${b64}`} className="w-full" />
    </div>
  );
}

function McpAppArtifact({ artifact }: { artifact: ArtifactPayload }) {
  const file = artifact.data['excalidrawFile'];
  if (typeof file !== 'string') return null;
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

function ArtifactInline({ artifact }: { artifact: ArtifactPayload }) {
  if (artifact.type === 'image') return <ImageArtifact artifact={artifact} />;
  if (artifact.type === 'audio') return <AudioArtifact artifact={artifact} />;
  if (artifact.type === 'mcp_app') return <McpAppArtifact artifact={artifact} />;
  return null;
}

interface Props { message: DisplayMessage; }

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <div data-role={message.role} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-lg rounded-2xl px-4 py-2.5 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
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
