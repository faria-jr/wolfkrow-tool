'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

interface ChatSessionData {
  id: string;
  title: string | undefined;
  lastActivity: string;
  archived: boolean;
}

interface Props {
  activeSessionId: string | undefined;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function ChatSessions({ activeSessionId, onSelectSession, onNewSession }: Props) {
  const { sessions, createSession, deleteSession, loadSessions } = useSessions();

  const handleNew = useCallback(async () => {
    const id = await createSession();
    if (id) {
      onSelectSession(id);
      onNewSession();
    }
  }, [createSession, onSelectSession, onNewSession]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this chat session?')) return;
    await deleteSession(id);
    if (id === activeSessionId) onNewSession();
  }, [deleteSession, activeSessionId, onNewSession]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  return (
    <aside className="flex w-56 flex-col gap-1 border-r bg-muted/30 p-2">
      <Button size="sm" className="mb-1 w-full" onClick={() => void handleNew()}>
        + New Chat
      </Button>
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            active={s.id === activeSessionId}
            onSelect={() => onSelectSession(s.id)}
            onDelete={(e) => void handleDelete(s.id, e)}
          />
        ))}
      </div>
    </aside>
  );
}

interface ItemProps {
  session: ChatSessionData;
  active: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionItem({ session, active, onSelect, onDelete }: ItemProps) {
  const label = session.title || 'New Chat';
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={onDelete}
        onKeyDown={(e) => e.key === 'Enter' && onDelete(e as unknown as React.MouseEvent)}
        className={`ml-1 hidden shrink-0 rounded p-0.5 text-xs opacity-60 hover:opacity-100 group-hover:flex ${
          active ? 'text-primary-foreground' : 'hover:bg-destructive/10 hover:text-destructive'
        }`}
        aria-label="Delete session"
      >
        ✕
      </span>
    </button>
  );
}

function useSessions() {
  const [sessions, setSessions] = useState<ChatSessionData[]>([]);

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/chat/sessions');
    if (res.ok) {
      const data = (await res.json()) as ChatSessionData[];
      setSessions(data);
    }
  }, []);

  const createSession = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/chat/sessions', { method: 'POST' });
    if (!res.ok) return null;
    const data = (await res.json()) as ChatSessionData;
    setSessions((prev) => [data, ...prev]);
    return data.id;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { sessions, createSession, deleteSession, loadSessions };
}
