/**
 * Port de adapter de secrets (keytar / key-value store externo).
 *
 * Distinto de `SecretRepo` (metadata de secrets no DB): este port abstrai o
 * armazenamento do VALOR (keytar, vault, etc.). Antes `SecretsAdapter` vivia
 * em `@wolfkrow/use-cases` (vault) e `KeytarSecretsAdapter` não o implementava
 * formalmente. Movido para o domínio.
 */

export interface SecretsAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}
