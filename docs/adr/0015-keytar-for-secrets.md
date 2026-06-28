# ADR-0015: keytar para Secrets (OS Keychain)

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool precisa armazenar secrets (API keys, OAuth tokens) com segurança:

- Anthropic API key
- OpenAI API key
- ElevenLabs API key
- Cartesia API key
- Google OAuth tokens (Calendar/Gmail/Drive/Sheets)
- Telegram bot token
- Codex OAuth tokens

Opções:

1. **Plaintext em arquivos**: zero security
2. **Encrypted files**: próprio crypto é arriscado
3. **Environment variables**: visíveis em `ps aux`, logs, etc
4. **OS Keychain (keytar)**: usa keychain do OS (macOS Keychain, Windows Credential Vault, Linux Secret Service)
5. **Cloud KMS**: requer cloud, não é self-hosted

## Decisão

**keytar** (Node.js binding para OS keychain).

```typescript
// packages/infra/src/secrets/keytar-adapter.ts
import keytar from 'keytar';

const SERVICE_NAME = 'wolfkrow-tool';

export class KeytarSecretsAdapter implements SecretsAdapter {
  async get(key: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, key);
  }

  async set(key: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, key, value);
  }

  async delete(key: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, key);
  }

  async list(): Promise<string[]> {
    const all = await keytar.findCredentials(SERVICE_NAME);
    return all.map((c) => c.account);
  }
}

// Domain interface
export interface SecretsAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}
```

## Consequências

### Positivas

- **OS-level encryption**: AES-256 via OS APIs
- **Cross-platform**: macOS, Windows, Linux
- **Biometric unlock**: Touch ID no macOS, Windows Hello
- **Zero-knowledge**: app não tem access ao master password
- **Sandbox**: Electron wrapper + Worker rodam com user privileges
- **Standard**: usado por 1Password CLI, AWS CLI, etc

### Negativas

- **Native module**: precisa rebuild para Electron + Node.js
- **Linux sem keyring**: pode falhar em headless
- **Migration**: chaves criadas em outro OS não migram
- **Backup**: keychain é per-OS, backup precisa exportar

### Mitigações

- Fallback para encrypted file storage em Linux headless
- Documentação de migração entre OSes
- Export/import feature no app

## Storage Architecture

### Service: `wolfkrow-tool`

### Keys (examples):

- `anthropic-api-key`
- `openai-api-key`
- `elevenlabs-api-key`
- `cartesia-api-key`
- `google-oauth-refresh-token`
- `telegram-bot-token`
- `codex-oauth-token`

### Usage Pattern

```typescript
// Worker
const anthropicKey = await secrets.get('anthropic-api-key');
if (!anthropicKey) throw new ConfigError('Missing ANTHROPIC_API_KEY');

const anthropic = new Anthropic({ apiKey: anthropicKey });
```

**Nunca** expor secrets ao browser. Sempre via Worker proxy:

```typescript
// Next.js Route Handler
export async function GET(req: NextRequest) {
  const session = await requireSession();

  // Worker has access to keychain
  const response = await fetch('http://localhost:4000/config/anthropic', {
    headers: { Authorization: `Bearer ${session.token}` },
  });

  // Returns masked key only (sk-ant-...XXXX)
  const { maskedKey } = await response.json();
  return Response.json({ maskedKey });
}
```

## UI Display

```typescript
// apps/web/components/vault/SecretCard.tsx
export function SecretCard({ name, maskedValue }: { name: string; maskedValue: string }) {
  const [show, setShow] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent>
        {show ? <Input value={maskedValue} disabled /> : <code>••••••••{maskedValue.slice(-4)}</code>}
        <Button onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'Show'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Audit Log

```typescript
// packages/infra/src/secrets/keytar-adapter.ts
async get(key: string): Promise<string | null> {
  const value = await keytar.getPassword(SERVICE_NAME, key);

  logger.info({ key, accessed: true }, 'secret accessed');

  // Audit log to DB
  await auditLog.record({
    action: 'secret.access',
    key,
    timestamp: new Date(),
    userId: session.userId,
  });

  return value;
}
```

## Alternativas Consideradas

### A. dotenv + .env file

**Prós**: Simples
**Contras**: Plaintext, visível em backups, sem encryption
**Decisão**: ❌ Rejeitado — security fraco

### B. encrypted-json (AES-256-GCM com password do user)

**Prós**: Portável, sem dependência de OS
**Contras**: Implementação própria é arriscada, password management difícil
**Decisão**: 🤔 Fallback para Linux sem keyring

### C. node-keytar (mantido)

**Decisão**: ✅ Escolhido

### D. @napi-rs/keyring (Rust binding, melhor manutenção)

**Prós**: Mais ativo, melhor performance
**Contras**: Menos maduro, menos usado
**Decisão**: 🤔 Considerado para v1.1

### E. HashiCorp Vault

**Prós**: Industry standard
**Contras**: Requer Vault server (não é self-hosted simple)
**Decisão**: ❌ Rejeitado — overkill

## References

- [keytar](https://github.com/atom/node-keytar)
- [macOS Keychain](https://developer.apple.com/documentation/security/keychain_services)
- [Windows Credential Vault](https://docs.microsoft.com/en-us/windows/uwp/security/credential-locker)
- [Linux Secret Service](https://specifications.freedesktop.org/secret-service/latest/)
