import type { Metadata } from 'next';

import { ChatView } from '@/components/chat/chat-view';

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
        <ChatView />
      </main>
    </div>
  );
}
