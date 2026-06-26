/**
 * EPIC 2.2 — Dynamic app version.
 *
 * Injected at build time by next.config.ts (NEXT_PUBLIC_APP_VERSION, read from
 * apps/web/package.json) so the sidebar never shows a stale hard-coded value.
 * Falls back to a literal so the UI still renders if the env is absent (tests).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
