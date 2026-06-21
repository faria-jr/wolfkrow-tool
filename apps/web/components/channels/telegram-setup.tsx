'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Status = 'idle' | 'loading' | 'error';

export function TelegramSetup() {
  const [running, setRunning] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setStatus('loading');
    setError(null);
    try {
      const endpoint = running ? '/api/telegram/stop' : '/api/telegram/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      setRunning(!running);
      if (!running) setPairingCode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setStatus('idle');
    }
  }

  async function handlePair() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/telegram/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'current' }),
      });
      if (!res.ok) throw new Error('Failed to generate code');
      const d = await res.json() as { code: string };
      setPairingCode(d.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Telegram Bot</h3>
          <p className="text-sm text-muted-foreground">
            Status: <span className={running ? 'text-green-500' : 'text-gray-400'}>{running ? 'Running' : 'Stopped'}</span>
          </p>
        </div>
        <Button
          onClick={() => void handleToggle()}
          disabled={status === 'loading'}
          variant={running ? 'destructive' : 'default'}
          size="sm"
        >
          {running ? 'Stop' : 'Start'}
        </Button>
      </div>

      {running && (
        <div className="flex flex-col gap-2">
          <Button onClick={() => void handlePair()} disabled={status === 'loading'} variant="outline" size="sm">
            Generate Pairing Code
          </Button>
          {pairingCode && (
            <div className="flex items-center gap-2">
              <Input value={pairingCode} readOnly className="font-mono text-lg tracking-widest" />
              <p className="text-xs text-muted-foreground">Send <code>/pair {pairingCode}</code> to your bot</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
