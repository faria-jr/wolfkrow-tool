'use client';

import { Check, KeyRound, RefreshCw, Send, Settings, ShieldAlert, User } from 'lucide-react';
import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = 'idle' | 'loading' | 'error';

interface TelegramSetupViewProps {
  botToken: string;
  error: string | null;
  hasToken: boolean;
  hasUserId: boolean;
  hasUsername: boolean;
  notifyScheduler: boolean;
  onBotTokenChange: (value: string) => void;
  onNotifySchedulerChange: (value: boolean) => void;
  onPair: () => Promise<void>;
  onSaveConfig: () => Promise<void>;
  onToggle: () => Promise<void>;
  onUserIdChange: (value: string) => void;
  onUserNameChange: (value: string) => void;
  pairingCode: string | null;
  running: boolean;
  saving: boolean;
  status: Status;
  userIdVal: string;
  userName: string;
}

export function TelegramSetupView(props: TelegramSetupViewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TelegramConfigCard {...props} />
      <TelegramControlsCard {...props} />
    </div>
  );
}

function TelegramConfigCard(props: TelegramSetupViewProps) {
  const canSave = props.saving || (!props.botToken && !props.userName && !props.userIdVal);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="text-primary h-5 w-5" />
          Telegram Bridge Configuration
        </CardTitle>
        <CardDescription>
          Configure Bot credentials and security constraints. Secrets are encrypted locally.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TelegramSecretFields {...props} />
        <NotifySchedulerField
          checked={props.notifyScheduler}
          onCheckedChange={props.onNotifySchedulerChange}
        />
        <Button className="mt-2 w-full" disabled={canSave} onClick={props.onSaveConfig}>
          {props.saving ? 'Saving...' : 'Save Configurations'}
        </Button>
      </CardContent>
    </Card>
  );
}

function TelegramSecretFields(props: TelegramSetupViewProps) {
  return (
    <>
      <SecretInput
        configured={props.hasToken}
        icon={<KeyRound className="text-muted-foreground h-3.5 w-3.5" />}
        id="bot-token"
        label="Bot Token"
        onChange={props.onBotTokenChange}
        placeholder={props.hasToken ? '••••••••••••••••' : 'Enter bot token from BotFather'}
        type="password"
        value={props.botToken}
      />
      <SecretInput
        configured={props.hasUsername}
        icon={<User className="text-muted-foreground h-3.5 w-3.5" />}
        id="username"
        label="Authorized Username"
        onChange={props.onUserNameChange}
        placeholder="e.g. juniorfaria"
        value={props.userName}
      />
      <SecretInput
        configured={props.hasUserId}
        icon={<ShieldAlert className="text-muted-foreground h-3.5 w-3.5" />}
        id="userid"
        label="Authorized User ID"
        onChange={props.onUserIdChange}
        placeholder="e.g. 123456789"
        value={props.userIdVal}
      />
    </>
  );
}

function TelegramControlsCard(props: TelegramSetupViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="text-primary h-5 w-5" />
          Bot Client Controls
        </CardTitle>
        <CardDescription>Start, stop, and pair your active Telegram connection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ServiceStatusPanel {...props} />
        {!props.hasToken && <TokenRequiredWarning />}
        {props.running && <PairingPanel {...props} />}
        {props.error && (
          <p className="text-destructive text-sm" role="alert">
            {props.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SecretInput({
  configured,
  icon,
  id,
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  configured: boolean;
  icon: React.ReactNode;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {icon}
        {label}
        {configured && <ConfiguredBadge />}
      </Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </div>
  );
}

function ConfiguredBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-xs font-medium text-green-500">
      <Check className="h-2.5 w-2.5" /> Configured
    </span>
  );
}

function NotifySchedulerField({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2 pt-2">
      <Checkbox
        checked={checked}
        id="notify-scheduler"
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
      />
      <Label
        className="text-muted-foreground cursor-pointer select-none text-xs font-normal"
        htmlFor="notify-scheduler"
      >
        Notify me about task scheduler updates
      </Label>
    </div>
  );
}

function ServiceStatusPanel(props: TelegramSetupViewProps) {
  return (
    <div className="bg-muted/20 flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-semibold">Service Status</p>
        <p className="text-muted-foreground text-xs">
          Bot instance is currently{' '}
          <span className={props.running ? 'font-bold text-green-500' : 'text-zinc-500'}>
            {props.running ? 'Running' : 'Stopped'}
          </span>
        </p>
      </div>
      <Button
        disabled={props.status === 'loading'}
        onClick={props.onToggle}
        size="sm"
        variant={props.running ? 'destructive' : 'default'}
      >
        <ToggleButtonContent running={props.running} status={props.status} />
      </Button>
    </div>
  );
}

function ToggleButtonContent({ running, status }: { running: boolean; status: Status }) {
  if (status === 'loading') {
    return <RefreshCw className="h-4 w-4 animate-spin" />;
  }
  return running ? 'Stop' : 'Start';
}

function TokenRequiredWarning() {
  return (
    <div className="flex gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-500">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span>You must save your Bot Token first to enable the starting controls.</span>
    </div>
  );
}

function PairingPanel(props: TelegramSetupViewProps) {
  return (
    <div className="bg-muted/10 flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-xs font-semibold">Pair Your Account</p>
      <Button
        className="w-full"
        disabled={props.status === 'loading'}
        onClick={props.onPair}
        size="sm"
        variant="outline"
      >
        Generate Pairing Code
      </Button>
      {props.pairingCode && <PairingCode code={props.pairingCode} />}
    </div>
  );
}

function PairingCode({ code }: { code: string }) {
  return (
    <div className="mt-1 space-y-2">
      <Input
        className="bg-zinc-950 text-center font-mono text-lg font-bold tracking-widest text-amber-500"
        readOnly
        value={code}
      />
      <p className="text-muted-foreground text-center text-xs">
        Send command{' '}
        <code className="bg-muted rounded px-1.5 py-0.5 text-amber-400">/pair {code}</code> to your
        Telegram bot.
      </p>
    </div>
  );
}
