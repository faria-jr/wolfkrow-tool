import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
  });

  test('tasks page loads with list', async ({ page }) => {
    await expect(page).toHaveURL(/tasks/);
    // Either shows task list or empty state
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('new task button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new task|add task|create/i })).toBeVisible();
  });

  test('create task dialog opens', async ({ page }) => {
    await page.getByRole('button', { name: /new task|add task|create/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/title/i)).toBeVisible();
  });
});
