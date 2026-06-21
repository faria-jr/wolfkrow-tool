/**
 * Visual regression tests — Playwright snapshots.
 * Run once to generate baselines: pnpm test:e2e --update-snapshots
 * Subsequent runs compare against stored snapshots.
 */

import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login.png', { maxDiffPixels: 200 });
  });

  test('chat page (empty) matches snapshot', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('chat-empty.png', { maxDiffPixels: 200 });
  });
});
