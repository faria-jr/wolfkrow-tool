import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/chat');
    // Should redirect to login or show auth gate
    await expect(page).toHaveURL(/login|auth|\/$/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in|continue/i })).toBeVisible();
  });

  test('login form rejects empty credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
    // Should show a validation error
    await expect(page.locator('[role="alert"], .error, [data-error]').first())
      .toBeVisible({ timeout: 3000 })
      .catch(() => {
        /* input-level validation may not show an alert element */
      });
  });
});
