'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GoogleService {
  name: string;
  vaultKey: string;
  label: string;
  scopeHint: string;
}

const GOOGLE_SERVICES: GoogleService[] = [
  {
    name: 'google-drive',
    vaultKey: 'google-drive-token',
    label: 'Google Drive',
    scopeHint: 'https://www.googleapis.com/auth/drive.readonly',
  },
  {
    name: 'google-sheets',
    vaultKey: 'google-sheets-token',
    label: 'Google Sheets',
    scopeHint: 'https://www.googleapis.com/auth/spreadsheets',
  },
  {
    name: 'google-gmail',
    vaultKey: 'google-gmail-token',
    label: 'Gmail',
    scopeHint: 'https://www.googleapis.com/auth/gmail.readonly',
  },
  {
    name: 'google-calendar',
    vaultKey: 'google-calendar-token',
    label: 'Google Calendar',
    scopeHint: 'https://www.googleapis.com/auth/calendar.readonly',
  },
];

interface Props {
  configuredServers: string[];
}

export function GoogleOAuthPanel({ configuredServers }: Props) {
  const relevant = GOOGLE_SERVICES.filter((s) => configuredServers.includes(s.name));
  if (relevant.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-1 font-semibold">Google OAuth Tokens</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Google MCP servers require OAuth access tokens. Obtain tokens via{' '}
        <code className="rounded bg-muted px-1">gcloud auth print-access-token</code>{' '}
        or the Google OAuth Playground, then save them below.
      </p>
      <div className="flex flex-col gap-3">
        {relevant.map((svc) => (
          <ServiceTokenRow key={svc.name} service={svc} />
        ))}
      </div>
    </div>
  );
}

function ServiceTokenRow({ service }: { service: GoogleService }) {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    if (!token.trim()) return;
    setStatus('saving');
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: service.vaultKey,
          value: token.trim(),
          displayName: `${service.label} OAuth Token`,
          category: 'oauth',
        }),
      });
      setStatus(res.ok ? 'saved' : 'error');
      if (res.ok) setToken('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="w-32 text-sm font-medium">{service.label}</span>
        <Input
          type="password"
          placeholder={`Paste ${service.label} access token`}
          value={token}
          onChange={(e) => { setToken(e.target.value); setStatus('idle'); }}
          className="flex-1 font-mono text-xs"
        />
        <Button size="sm" disabled={!token.trim() || status === 'saving'} onClick={() => void save()}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save'}
        </Button>
      </div>
      <p className="pl-32 text-xs text-muted-foreground">
        Scope: <code className="rounded bg-muted px-1">{service.scopeHint}</code>
      </p>
      {status === 'error' && <p className="pl-32 text-xs text-destructive">Failed to save token</p>}
    </div>
  );
}
