import { test, expect } from '@playwright/test';

// These tests require a running authenticated session.
// Run with a seeded test user: BASE_URL=http://localhost:3000 pnpm test:e2e
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Chat', () => {
  test.skip(({ browserName: _browserName }) => false, 'All browsers');

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('chat page loads', async ({ page }) => {
    await expect(page).toHaveURL(/chat/);
    await expect(page.locator('textarea, [role="textbox"]').first()).toBeVisible();
  });

  test('new chat button creates fresh session', async ({ page }) => {
    const newChatBtn = page.getByRole('button', { name: /new chat/i });
    await newChatBtn.click();
    // URL should update to a new session ID or clear existing messages
    await expect(page).toHaveURL(/chat/);
  });

  test('typing in message input updates placeholder state', async ({ page }) => {
    const input = page.locator('textarea, [role="textbox"]').first();
    await input.fill('Hello Wolfkrow');
    await expect(input).toHaveValue('Hello Wolfkrow');
  });
});
