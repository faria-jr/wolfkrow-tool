# SPEC-011: Vault (Secrets via keytar)

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P0 (security)

---

## 1. Visão Geral

Armazenamento criptografado de API keys e secrets via OS keychain (keytar). Nunca exposto ao browser (apenas masked display).

---

## 2. Database Schema

```typescript
// Apenas metadata (não values)
export const secretsMetadata = sqliteTable('secrets_metadata', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  key: text('key').notNull().unique(), // 'anthropic-api-key', etc
  displayName: text('display_name').notNull(),
  description: text('description'),
  category: text('category', { enum: ['ai', 'integration', 'oauth', 'other'] }),
  lastAccessed: integer('last_accessed', { mode: 'timestamp' }),
  lastRotated: integer('last_rotated', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 3. Adapter

```typescript
// packages/infra/src/secrets/keytar-adapter.ts
import keytar from 'keytar';

const SERVICE = 'wolfkrow-tool';

export class KeytarSecretsAdapter {
  async get(key: string): Promise<string | null> {
    return keytar.getPassword(SERVICE, key);
  }
  
  async set(key: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE, key, value);
  }
  
  async delete(key: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE, key);
  }
  
  async list(): Promise<string[]> {
    const all = await keytar.findCredentials(SERVICE);
    return all.map((c) => c.account);
  }
}
```

---

## 4. Use Cases

```typescript
// packages/use-cases/src/vault/store-secret.ts
@injectable()
export class StoreSecret {
  constructor(
    @inject('SecretsAdapter') private secrets: SecretsAdapter,
    @inject('SecretsMetadataRepo') private repo: SecretsMetadataRepo,
  ) {}
  
  async execute(input: StoreSecretInput): Promise<void> {
    // 1. Validate
    StoreSecretInputSchema.parse(input);
    
    // 2. Store in keytar
    await this.secrets.set(input.key, input.value);
    
    // 3. Update metadata
    await this.repo.upsert({
      key: input.key,
      displayName: input.displayName,
      description: input.description,
      category: input.category,
      lastRotated: new Date(),
    });
  }
}
```

---

## 5. UI

### VaultPage

```tsx
'use client';
export function VaultPage() {
  const { data: secrets } = useSecrets();
  
  return (
    <div className="space-y-4">
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Encrypted with OS Keychain</AlertTitle>
        <AlertDescription>
          Secrets are stored using your operating system's secure storage.
          On macOS: Keychain. On Windows: Credential Vault. On Linux: Secret Service.
        </AlertDescription>
      </Alert>
      
      <DataTable
        data={secrets}
        columns={[
          { accessorKey: 'displayName', header: 'Name' },
          { accessorKey: 'key', header: 'Key' },
          { accessorKey: 'category', header: 'Category' },
          { accessorKey: 'lastAccessed', header: 'Last Accessed', cell: (s) => formatRelativeTime(s.lastAccessed) },
          { id: 'value', header: 'Value', cell: (s) => <SecretValue secret={s} /> },
          { id: 'actions', cell: (s) => <SecretActions secret={s} /> },
        ]}
      />
      
      <Button onClick={() => setShowAddModal(true)}>Add Secret</Button>
    </div>
  );
}
```

---

## 6. Security

- Secrets nunca trafegam para browser
- UI mostra apenas `••••••••XXXX` (últimos 4 chars)
- Audit log de todos os acessos
- Rotação incentivada a cada 90 dias

---

## 7. Testes

- Keytar set/get/delete
- Metadata CRUD
- UI masked display
- Audit log
- Backup/export (encrypted)
