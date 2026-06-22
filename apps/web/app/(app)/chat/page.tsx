import type { Metadata } from 'next';

import { ChatView } from '@/components/chat/chat-view';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with AI',
};

export default function ChatPage() {
  return <ChatView />;
}
