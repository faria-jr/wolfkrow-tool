import type { Repository } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

/** Entidade persistível identificada por string (cumpre o port Repository<T>). */
export interface Entity {
  id: string;
}

type Db = BetterSQLite3Database<Record<string, never>>;

/**
 * Base genérica para repositórios Drizzle. Implementa o CRUD do port
 * Repository<T> do domínio; subclasses mapeiam row↔entity (toEntity/toRow).
 * Reduz boilerplate (DRY) e mantém LSP (intercambiável com InMemoryRepo).
 */
export abstract class DrizzleRepo<T extends Entity> implements Repository<T, string> {
  constructor(
    protected readonly db: Db,
    protected readonly table: SQLiteTable & { readonly id: SQLiteColumn }
  ) {}

  async findById(id: string): Promise<T | null> {
    const rows = this.db
      .select()
      .from(this.table)
      // never: tipagem de coluna Drizzle é notoriamente genérica; value é string.
      .where(eq(this.table.id, id as never))
      .all();
    const row = rows[0];
    return row ? this.toEntity(row as Record<string, unknown>) : null;
  }

  async save(entity: T): Promise<T> {
    const row = this.toRow(entity);
    this.db
      .insert(this.table)
      .values(row)
      .onConflictDoUpdate({ target: this.table.id, set: row })
      .run();
    return entity;
  }

  async delete(id: string): Promise<void> {
    this.db
      .delete(this.table)
      .where(eq(this.table.id, id as never))
      .run();
  }

  protected abstract toEntity(row: Record<string, unknown>): T;
  protected abstract toRow(entity: T): Record<string, unknown>;
}

/**
 * Repo in-memory (Map) para testes e dev. Mesmo port Repository<T> que DrizzleRepo
 * — use-cases não distinguem (LSP). Zero deps, zero I/O.
 */
export class InMemoryRepo<T extends Entity> implements Repository<T, string> {
  private readonly store = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async save(entity: T): Promise<T> {
    this.store.set(entity.id, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  /** Snapshot para asserções em testes. */
  snapshot(): T[] {
    return [...this.store.values()];
  }
}
