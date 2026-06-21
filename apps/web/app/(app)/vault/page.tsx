import { VaultView } from '@/components/vault/vault-view';

export default function VaultPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Vault</h1>
        <p className="text-sm text-muted-foreground">Encrypted API keys and secrets</p>
      </div>
      <VaultView />
    </div>
  );
}
