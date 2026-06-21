/**
 * Ports de repositório (interfaces). O domínio define os contratos; a infra
 * implementa (DrizzleXxxRepo / InMemoryXxxRepo). Repos específicos por entidade
 * (UserRepo, SessionRepo...) são adicionados nas fases que criam a entidade.
 */

/** Port base genérico — CRUD mínimo. Sub-interfaces estendem com queries. */
export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}

export type { UserRepo } from './user-repo';
export type { ChatSessionRepo, MessageRepo } from './chat-repos';
