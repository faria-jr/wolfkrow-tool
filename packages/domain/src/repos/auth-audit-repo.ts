/**
 * Port de repositório de auth audit .
 *
 * Antes `AuthAuditEntry`/`AuthAuditAction` eram tipos inline em infra. Contrato
 * movido para o domínio; `DrizzleAuthAuditRepo` o implementa. `action` é
 * `string` na fronteira (a infra restringe ao enum da coluna na escrita).
 */

export interface AuthAuditEntry {
 userId: string | undefined;
 action: string;
 ip: string | undefined;
 userAgent: string | undefined;
}

export interface AuthAuditRepo {
 log(entry: AuthAuditEntry): void;
}
