'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import { toast } from 'sonner';

import { TelegramSetupView } from './telegram-setup-view';

type Status = 'idle' | 'loading' | 'error';

interface VaultSecret {
  displayName: string;
  key: string;
}

interface TelegramConfigPresence {
  hasToken: boolean;
  hasUserId: boolean;
  hasUsername: boolean;
  notifyScheduler: boolean;
}

const TELEGRAM_SECRETS = {
  botToken: 'telegram-bot-token',
  notifyScheduler: 'telegram-notify-scheduler',
  userId: 'telegram-user-id',
  username: 'telegram-username',
} as const;

export function TelegramSetup() {
  const state = useTelegramSetupState();
  return <TelegramSetupView {...state} />;
}

function useTelegramSetupState() {
  const [form, setForm] = useState({ botToken: '', userIdVal: '', userName: '' });
  const [presence, setPresence] = useState<TelegramConfigPresence>(emptyPresence());
  const [notifyScheduler, setNotifyScheduler] = useState(false);
  const [running, setRunning] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const snapshot = await loadTelegramSnapshot();
    setRunning(snapshot.running);
    setPresence(snapshot.presence);
    setNotifyScheduler(snapshot.presence.notifyScheduler);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updateField = (field: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return {
    ...form,
    ...presence,
    error,
    notifyScheduler,
    onBotTokenChange: updateField('botToken'),
    onNotifySchedulerChange: setNotifyScheduler,
    onPair: usePairingCode(setStatus, setError, setPairingCode),
    onSaveConfig: useSaveTelegramConfig({
      form,
      notifyScheduler,
      refresh,
      setForm,
      setSaving,
    }),
    onToggle: useToggleBot({ running, setError, setPairingCode, setRunning, setStatus }),
    pairingCode,
    running,
    saving,
    status,
    onUserIdChange: updateField('userIdVal'),
    onUserNameChange: updateField('userName'),
  };
}

function emptyPresence(): TelegramConfigPresence {
  return {
    hasToken: false,
    hasUserId: false,
    hasUsername: false,
    notifyScheduler: false,
  };
}

async function loadTelegramSnapshot() {
  const [running, presence] = await Promise.all([
    loadTelegramRunningState(),
    loadTelegramConfigPresence(),
  ]);

  return { presence, running };
}

async function loadTelegramRunningState() {
  try {
    const response = await fetch('/api/telegram/status');
    if (!response.ok) return false;
    const payload = (await response.json()) as { running?: boolean };
    return Boolean(payload.running);
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function loadTelegramConfigPresence(): Promise<TelegramConfigPresence> {
  try {
    const response = await fetch('/api/vault');
    if (!response.ok) return emptyPresence();
    const secrets = (await response.json()) as unknown;
    if (!Array.isArray(secrets)) return emptyPresence();
    return parseTelegramSecrets(secrets);
  } catch (error) {
    console.error(error);
    return emptyPresence();
  }
}

function parseTelegramSecrets(secrets: VaultSecret[]): TelegramConfigPresence {
  const byKey = new Map(secrets.map((secret) => [secret.key, secret]));
  const notifySecret = byKey.get(TELEGRAM_SECRETS.notifyScheduler);

  return {
    hasToken: byKey.has(TELEGRAM_SECRETS.botToken),
    hasUserId: byKey.has(TELEGRAM_SECRETS.userId),
    hasUsername: byKey.has(TELEGRAM_SECRETS.username),
    notifyScheduler: notifySecret?.displayName === 'true',
  };
}

interface SaveTelegramConfigArgs {
  form: { botToken: string; userIdVal: string; userName: string };
  notifyScheduler: boolean;
  refresh: () => Promise<void>;
  setForm: React.Dispatch<
    React.SetStateAction<{ botToken: string; userIdVal: string; userName: string }>
  >;
  setSaving: (value: boolean) => void;
}

function useSaveTelegramConfig({
  form,
  notifyScheduler,
  refresh,
  setForm,
  setSaving,
}: SaveTelegramConfigArgs) {
  return async () => {
    setSaving(true);
    try {
      await saveTelegramConfig(form, notifyScheduler);
      toast.success('Telegram configurations saved successfully!');
      if (form.botToken) {
        setForm((current) => ({ ...current, botToken: '' }));
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save configurations');
    } finally {
      setSaving(false);
    }
  };
}

async function saveTelegramConfig(
  form: { botToken: string; userIdVal: string; userName: string },
  notifyScheduler: boolean
) {
  const writes = buildTelegramSecretWrites(form, notifyScheduler);

  for (const write of writes) {
    await saveVaultSecret(write);
  }
}

function buildTelegramSecretWrites(
  form: { botToken: string; userIdVal: string; userName: string },
  notifyScheduler: boolean
) {
  const writes = [
    secretWrite(TELEGRAM_SECRETS.notifyScheduler, notifyScheduler ? 'true' : 'false'),
  ];

  if (form.botToken && form.botToken !== '********') {
    writes.push(secretWrite(TELEGRAM_SECRETS.botToken, form.botToken, 'Telegram Bot Token'));
  }
  if (form.userName) {
    writes.push(secretWrite(TELEGRAM_SECRETS.username, form.userName));
  }
  if (form.userIdVal) {
    writes.push(secretWrite(TELEGRAM_SECRETS.userId, form.userIdVal));
  }

  return writes;
}

function secretWrite(key: string, value: string, displayName = value) {
  return {
    category: 'integration',
    displayName,
    key,
    value,
  };
}

async function saveVaultSecret(payload: ReturnType<typeof secretWrite>) {
  const response = await fetch('/api/vault', {
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to save ${payload.key}`);
  }
}

interface ToggleBotArgs {
  running: boolean;
  setError: (value: string | null) => void;
  setPairingCode: (value: string | null) => void;
  setRunning: (value: boolean) => void;
  setStatus: (value: Status) => void;
}

function useToggleBot({ running, setError, setPairingCode, setRunning, setStatus }: ToggleBotArgs) {
  return async () => {
    setStatus('loading');
    setError(null);
    try {
      await toggleTelegramBot(running);
      setRunning(!running);
      if (!running) setPairingCode(null);
      toast.success(running ? 'Telegram bot stopped.' : 'Telegram bot started successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error toggling bot';
      setError(message);
      toast.error(message);
    } finally {
      setStatus('idle');
    }
  };
}

async function toggleTelegramBot(running: boolean) {
  const endpoint = running ? '/api/telegram/stop' : '/api/telegram/start';
  const response = await fetch(endpoint, { method: 'POST' });
  if (response.ok) return;

  const payload = (await response.json()) as { error?: string };
  throw new Error(payload.error ?? 'Error toggling bot');
}

function usePairingCode(
  setStatus: (value: Status) => void,
  setError: (value: string | null) => void,
  setPairingCode: (value: string | null) => void
) {
  return async () => {
    setStatus('loading');
    setError(null);
    try {
      const code = await requestPairingCode();
      setPairingCode(code);
      toast.success('Pairing code generated!');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error');
    } finally {
      setStatus('idle');
    }
  };
}

async function requestPairingCode() {
  const response = await fetch('/api/telegram/pair', {
    body: JSON.stringify({ userId: 'current' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) throw new Error('Failed to generate code');
  const payload = (await response.json()) as { code: string };
  return payload.code;
}
