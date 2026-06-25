'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/chat/confirm-dialog';
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
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState<ChatSessionData | null>(null);

  const handleNew = useHandleNew(createSession, onSelectSession, onNewSession, setCreating);
  const confirmDelete = useConfirmDelete({
    getToDelete: () => toDelete,
    deleteSession,
    activeSessionId,
    onNewSession,
    setToDelete,
    setDeleting,
  });

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  return (
    <SessionsAside
      sessions={sessions}
      activeSessionId={activeSessionId}
      creating={creating}
      deleting={deleting}
      toDelete={toDelete}
      onSelectSession={onSelectSession}
      onNew={() => void handleNew()}
      onRequestDelete={setToDelete}
      onConfirmDelete={() => void confirmDelete()}
      onCancelDelete={() => setToDelete(null)}
    />
  );
}

function SessionsAside(props: {
  sessions: ChatSessionData[];
  activeSessionId: string | undefined;
  creating: boolean;
  deleting: boolean;
  toDelete: ChatSessionData | null;
  onSelectSession: (id: string) => void;
  onNew: () => void;
  onRequestDelete: (s: ChatSessionData) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}): ReactNode {
  return (
    <aside className="flex w-56 flex-col gap-1 border-r bg-muted/30 p-2">
      <Button size="sm" className="mb-1 w-full" disabled={props.creating} onClick={props.onNew}>
        {props.creating ? 'Creating…' : '+ New Chat'}
      </Button>
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {props.sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No sessions yet</p>
        )}
        {props.sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            active={s.id === props.activeSessionId}
            onSelect={() => props.onSelectSession(s.id)}
            onDelete={() => props.onRequestDelete(s)}
          />
        ))}
      </div>
      {props.toDelete && (
        <ConfirmDialog
          open
          title="Delete chat"
          description="Delete this chat session? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={props.onConfirmDelete}
          onCancel={props.onCancelDelete}
        />
      )}
      {props.deleting && <span className="sr-only" role="status">Deleting chat…</span>}
    </aside>
  );
}

interface ItemProps {
  session: ChatSessionData;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
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
        aria-label="Delete session"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDelete(); } }}
        className={`ml-1 hidden shrink-0 rounded p-0.5 text-xs opacity-60 hover:opacity-100 group-hover:flex ${
          active ? 'text-primary-foreground' : 'hover:bg-destructive/10 hover:text-destructive'
        }`}
      >
        ✕
      </span>
    </button>
  );
}

function useHandleNew(
  createSession: () => Promise<string | null>,
  onSelectSession: (id: string) => void,
  onNewSession: () => void,
  setCreating: (v: boolean) => void,
) {
  return useCallback(async () => {
    setCreating(true);
    try {
      const id = await createSession();
      if (id) { onSelectSession(id); onNewSession(); toast.success('New chat created'); }
      else { toast.error('Failed to create chat'); }
    } finally { setCreating(false); }
  }, [createSession, onSelectSession, onNewSession, setCreating]);
}

function useConfirmDelete(deps: {
  getToDelete: () => ChatSessionData | null;
  deleteSession: (id: string) => Promise<void>;
  activeSessionId: string | undefined;
  onNewSession: () => void;
  setToDelete: (s: ChatSessionData | null) => void;
  setDeleting: (v: boolean) => void;
}) {
  return useCallback(async () => {
    const toDelete = deps.getToDelete();
    if (!toDelete) return;
    deps.setDeleting(true);
    try {
      await deps.deleteSession(toDelete.id);
      if (toDelete.id === deps.activeSessionId) deps.onNewSession();
      toast.success('Chat deleted');
      deps.setToDelete(null);
    } catch {
      toast.error('Failed to delete chat');
    } finally {
      deps.setDeleting(false);
    }
  }, [deps]);
}

function useSessions() {
  const [sessions, setSessions] = useState<ChatSessionData[]>([]);

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/chat/sessions');
    if (res.ok) setSessions(((await res.json()) as ChatSessionData[]));
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
