'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Settings, ShieldAlert, KeyRound, User, Check, RefreshCw } from 'lucide-react';

type Status = 'idle' | 'loading' | 'error';

export function TelegramSetup() {
  const [botToken, setBotToken] = useState('');
  const [userName, setUserName] = useState('');
  const [userIdVal, setUserIdVal] = useState('');
  const [notifyScheduler, setNotifyScheduler] = useState(false);

  const [hasToken, setHasToken] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);
  const [hasUserId, setHasUserId] = useState(false);

  const [running, setRunning] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load status and config presence on mount
  const checkStatusAndConfig = async () => {
    try {
      const statusRes = await fetch('/api/telegram/status');
      if (statusRes.ok) {
        const d = await statusRes.json();
        setRunning(d.running);
      }

      const vaultRes = await fetch('/api/vault');
      if (vaultRes.ok) {
        const secrets = (await vaultRes.json()) as { key: string; displayName: string }[];
        const tokenSec = secrets.find((s) => s.key === 'telegram-bot-token');
        const userSec = secrets.find((s) => s.key === 'telegram-username');
        const idSec = secrets.find((s) => s.key === 'telegram-user-id');
        const notifySec = secrets.find((s) => s.key === 'telegram-notify-scheduler');

        setHasToken(!!tokenSec);
        setHasUsername(!!userSec);
        setHasUserId(!!idSec);
        setNotifyScheduler(notifySec ? notifySec.displayName === 'true' : false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void checkStatusAndConfig();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      if (botToken && botToken !== '********') {
        const r1 = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'telegram-bot-token',
            value: botToken,
            displayName: 'Telegram Bot Token',
            category: 'integration',
          }),
        });
        if (!r1.ok) throw new Error('Failed to save bot token');
      }

      if (userName) {
        const r2 = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'telegram-username',
            value: userName,
            displayName: userName,
            category: 'integration',
          }),
        });
        if (!r2.ok) throw new Error('Failed to save username');
      }

      if (userIdVal) {
        const r3 = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'telegram-user-id',
            value: userIdVal,
            displayName: userIdVal,
            category: 'integration',
          }),
        });
        if (!r3.ok) throw new Error('Failed to save user id');
      }

      const r4 = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'telegram-notify-scheduler',
          value: notifyScheduler ? 'true' : 'false',
          displayName: notifyScheduler ? 'true' : 'false',
          category: 'integration',
        }),
      });
      if (!r4.ok) throw new Error('Failed to save notification preference');

      toast.success('Telegram configurations saved successfully!');
      if (botToken) setBotToken('');
      void checkStatusAndConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configurations');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setStatus('loading');
    setError(null);
    try {
      const endpoint = running ? '/api/telegram/stop' : '/api/telegram/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const d = (await res.json()) as { error: string };
        throw new Error(d.error);
      }
      setRunning(!running);
      if (!running) setPairingCode(null);
      toast.success(running ? 'Telegram bot stopped.' : 'Telegram bot started successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error toggling bot');
      toast.error(err instanceof Error ? err.message : 'Error toggling bot');
    } finally {
      setStatus('idle');
    }
  };

  const handlePair = async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/telegram/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'current' }),
      });
      if (!res.ok) throw new Error('Failed to generate code');
      const d = (await res.json()) as { code: string };
      setPairingCode(d.code);
      toast.success('Pairing code generated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-5 w-5 text-primary" />
            Telegram Bridge Configuration
          </CardTitle>
          <CardDescription>
            Configure Bot credentials and security constraints. Secrets are encrypted locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bot-token" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Bot Token
              {hasToken && (
                <span className="inline-flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-medium">
                  <Check className="h-2.5 w-2.5" /> Configured
                </span>
              )}
            </Label>
            <Input
              id="bot-token"
              type="password"
              placeholder={hasToken ? '••••••••••••••••' : 'Enter bot token from BotFather'}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Authorized Username
              {hasUsername && (
                <span className="inline-flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-medium">
                  <Check className="h-2.5 w-2.5" /> Configured
                </span>
              )}
            </Label>
            <Input
              id="username"
              placeholder="e.g. juniorfaria"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="userid" className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
              Authorized User ID
              {hasUserId && (
                <span className="inline-flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-medium">
                  <Check className="h-2.5 w-2.5" /> Configured
                </span>
              )}
            </Label>
            <Input
              id="userid"
              placeholder="e.g. 123456789"
              value={userIdVal}
              onChange={(e) => setUserIdVal(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="notify-scheduler"
              checked={notifyScheduler}
              onCheckedChange={(checked) => setNotifyScheduler(!!checked)}
            />
            <Label htmlFor="notify-scheduler" className="text-xs font-normal text-muted-foreground cursor-pointer select-none">
              Notify me about task scheduler updates
            </Label>
          </div>

          <Button
            className="w-full mt-2"
            disabled={saving || (!botToken && !userName && !userIdVal)}
            onClick={handleSaveConfig}
          >
            {saving ? 'Saving...' : 'Save Configurations'}
          </Button>
        </CardContent>
      </Card>

      {/* Control Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5 text-primary" />
            Bot Client Controls
          </CardTitle>
          <CardDescription>
            Start, stop, and pair your active Telegram connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
            <div>
              <p className="text-sm font-semibold">Service Status</p>
              <p className="text-xs text-muted-foreground">
                Bot instance is currently{' '}
                <span className={running ? 'text-green-500 font-bold' : 'text-zinc-500'}>
                  {running ? 'Running' : 'Stopped'}
                </span>
              </p>
            </div>
            <Button
              onClick={handleToggle}
              disabled={status === 'loading' || !hasToken}
              variant={running ? 'destructive' : 'default'}
              size="sm"
            >
              {status === 'loading' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : running ? (
                'Stop Bot'
              ) : (
                'Start Bot'
              )}
            </Button>
          </div>

          {!hasToken && (
            <div className="flex gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-500">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>You must save your Bot Token first to enable the starting controls.</span>
            </div>
          )}

          {running && (
            <div className="flex flex-col gap-3 rounded-lg border p-4 bg-muted/10">
              <p className="text-xs font-semibold">Pair Your Account</p>
              <Button
                onClick={handlePair}
                disabled={status === 'loading'}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Generate Pairing Code
              </Button>
              {pairingCode && (
                <div className="space-y-2 mt-1">
                  <Input value={pairingCode} readOnly className="font-mono text-center text-lg tracking-widest bg-zinc-950 font-bold text-amber-500" />
                  <p className="text-[11px] text-center text-muted-foreground">
                    Send command <code className="bg-muted px-1.5 py-0.5 rounded text-amber-400">/pair {pairingCode}</code> to your Telegram bot.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
