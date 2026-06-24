'use client';

import { useCallback, useState } from 'react';

import { ChatSessions } from '@/components/chat/chat-sessions';
import { ChatView } from '@/components/chat/chat-view';

export default function ChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(undefined);
  }, []);

  return (
    <div className="flex h-full">
      <ChatSessions
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
      />
      <div className="flex-1 overflow-hidden">
        <ChatView {...(activeSessionId !== undefined ? { sessionId: activeSessionId } : {})} />
      </div>
    </div>
  );
}
