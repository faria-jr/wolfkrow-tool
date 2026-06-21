import { Terminal } from '@/components/terminal/terminal';

export default function TerminalPage() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Terminal</h1>
        <p className="text-sm text-muted-foreground">Interactive shell session</p>
      </div>
      <div className="flex-1">
        <Terminal className="h-full" />
      </div>
    </div>
  );
}
