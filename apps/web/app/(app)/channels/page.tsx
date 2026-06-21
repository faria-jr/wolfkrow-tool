import { TelegramSetup } from '@/components/channels/telegram-setup';

export default function ChannelsPage() {
  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-xl font-semibold">Channels</h1>
        <p className="text-sm text-muted-foreground">Connect external messaging channels</p>
      </div>
      <TelegramSetup />
    </div>
  );
}
