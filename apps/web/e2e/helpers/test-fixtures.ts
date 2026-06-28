/**
 * Fixtures compartilhadas — estendem `test` do Playwright com:
 *  - `authedPage` / `authedRequest`: páginas e contexts já autenticados.
 *  - `chatPage`: page já em /chat com mocks de SSE prontos.
 *
 * Os specs que precisam só de UI autenticada usam `authedPage`.
 * Os specs de chat (streaming, attachments) usam `chatPage`.
 */

import { test as base, expect, type Page } from '@playwright/test';

import { mockChatSessions, mockChatStream } from './sse-mock';

const STORAGE_STATE = 'e2e/.auth/user.json';

type Fixtures = {
  authedPage: Page;
  chatPage: Page;
};

export const test = base.extend<Fixtures>({
  authedPage: async ({ browser }, useFixture) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await useFixture(page);
    await context.close();
  },

  chatPage: async ({ browser }, useFixture) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await mockChatSessions(page);
    await mockChatStream(page, { deltas: ['Olá', ', ', 'estou pronto', '.'] });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await useFixture(page);
    await context.close();
  },
});

export { expect };

export async function expectToastOrAlert(page: Page, text: RegExp | string): Promise<void> {
  const pattern = typeof text === 'string' ? new RegExp(text, 'i') : text;
  const alert = page
    .locator('[role="alert"], [role="status"]')
    .filter({ hasText: pattern })
    .first();
  await expect(alert).toBeVisible({ timeout: 5000 });
}
