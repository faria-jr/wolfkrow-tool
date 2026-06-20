import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with AI',
};

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div>
          <h1 className="text-lg font-semibold">Chat</h1>
          <p className="text-xs text-muted-foreground">Multi-SDK AI conversation</p>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
              <span className="text-3xl">💬</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Chat — Phase 2</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Streaming chat with Claude, Codex, Lion-SDK and more. Implementation in progress.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              See <code className="rounded bg-muted px-1.5 py-0.5">docs/specs/SPEC-002-chat-streaming.md</code>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
