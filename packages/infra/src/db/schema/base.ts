/**
 * Drizzle helpers — common column types
 */

import { text, integer } from 'drizzle-orm/sqlite-core';

/**
 * UUID column (text-based, indexed automatically via primary key)
 */
export const id = () => text('id').primaryKey();

/**
 * Short text (max 255 chars)
 */
export const shortText = (name: string) => text(name).notNull();

/**
 * Long text (no length limit)
 */
export const longText = (name: string) => text(name).notNull();

/**
 * Timestamp (ms since epoch, stored as integer)
 */
export const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

/**
 * Metadata JSON column (default `{}`)
 */
export const metadata = () =>
  text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({});

/**
 * Common timestamp columns: createdAt, updatedAt
 */
export const timestamps = {
  createdAt: (): ReturnType<typeof timestamp> => timestamp('created_at').notNull(),
  updatedAt: (): ReturnType<typeof timestamp> => timestamp('updated_at').notNull(),
};

/**
 * Soft-delete column
 */
export const deletedAt = () => timestamp('deleted_at');
