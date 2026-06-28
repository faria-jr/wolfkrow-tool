/**
 * globalSetup — provisiona um usuário de teste antes de toda a suíte.
 *
 * Fluxo:
 *  1. Tenta /api/auth/setup (idempotente: 409 = já existe, ok).
 *  2. POST /api/auth/login para receber o cookie `session`.
 *  3. Persiste os cookies em `e2e/.auth/user.json` para que TODAS as specs
 *     herdem a sessão automaticamente via `storageState`.
 *
 * Requer `pnpm dev` (ou `pnpm start` em CI) rodando em http://localhost:3000.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { chromium, request, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3000';
const AUTH_DIR = path.join(__dirname, '..', '.auth');
const STORAGE_STATE = path.join(AUTH_DIR, 'user.json');

export const TEST_USER = {
  password: 'E2ETestPass1234',
  confirmPassword: 'E2ETestPass1234',
  displayName: 'E2E Test User',
} as const;

async function ensureSetup(api: APIRequestContext): Promise<void> {
  const res = await api.post('/api/auth/setup', { data: TEST_USER });
  if (res.ok()) return;
  if (res.status() === 409) return;
  const body = await res.text();
  throw new Error(`Setup failed (${res.status()}): ${body}`);
}

async function loginAndGetStorage(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    const res = await page.request.post('/api/auth/login', {
      data: { password: TEST_USER.password },
    });
    if (!res.ok()) {
      throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
    }
    await fs.mkdir(AUTH_DIR, { recursive: true });
    await context.storageState({ path: STORAGE_STATE });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(): Promise<void> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    await ensureSetup(api);
  } finally {
    await api.dispose();
  }
  await loginAndGetStorage();
}
