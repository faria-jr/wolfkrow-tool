import { expect, test } from './helpers/test-fixtures';

/**
 * Keyboard navigation (FE-6).
 *
 * Covers the keyboard flows the axe scan can't: skip-to-content, sidebar nav
 * reachable + activated by keyboard, and Escape dismissing the command palette.
 * Uses the shared `authedPage` fixture (storageState in helpers/).
 */
test.describe('Keyboard navigation', () => {
  test('skip-to-content link is the first tab stop and jumps to main', async ({ authedPage }) => {
    await authedPage.goto('/tasks');
    await authedPage.keyboard.press('Tab');
    const skip = authedPage.getByRole('link', { name: /skip to content/i });
    await expect(skip).toBeVisible();
    await authedPage.keyboard.press('Enter');
    const focusedId = await authedPage.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('main-content');
  });

  test('sidebar nav is reachable by keyboard and activates on Enter', async ({ authedPage }) => {
    await authedPage.goto('/tasks');
    const agentsLink = authedPage.locator('nav a, aside a').filter({ hasText: /^Agents$/ }).first();
    await agentsLink.focus();
    await authedPage.keyboard.press('Enter');
    await expect(authedPage).toHaveURL(/\/agents/);
  });

  test('command palette opens with ⌘K and closes on Escape', async ({ authedPage }) => {
    await authedPage.goto('/tasks');
    await authedPage.keyboard.press('Meta+K');
    // The palette renders a dialog (cmdk inside Radix Dialog).
    const dialog = authedPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await authedPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
