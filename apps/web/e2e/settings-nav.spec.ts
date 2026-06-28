import { expect, test } from './helpers/test-fixtures';

/**
 * Settings navigation hub (P0-5).
 *
 * The /settings index is a HUB linking to feature pages that live at their
 * own top-level routes. Every nav item rendered on the hub MUST resolve to a
 * real page (HTTP 200) — no dead `/settings/*` tabs and no double navigation.
 */
test.describe('Settings hub navigation', () => {
  test('every settings link resolves without 404', async ({ authedPage }) => {
    const deadRoutes: string[] = [];

    authedPage.on('response', async (response) => {
      if (response.status() === 404) {
        deadRoutes.push(response.url());
      }
    });

    await authedPage.goto('/settings');
    await expect(authedPage.getByRole('heading', { name: /settings/i })).toBeVisible();

    // Collect every hub link href before navigating, so iteration is stable.
    const hubLinks = await authedPage
      .getByRole('main')
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''));

    expect(hubLinks.length, 'hub should render navigation cards').toBeGreaterThan(0);

    for (const href of hubLinks) {
      const response = await authedPage.goto(href);
      expect(response?.status(), `expected ${href} to resolve (not 404)`).not.toBe(404);
      // Sanity: ensure we did not land on a Next.js not-found page.
      await expect(authedPage.getByText(/not found|this page could not be found/i)).toHaveCount(0);
      await authedPage.goto('/settings');
    }

    expect(deadRoutes, 'no 404 responses during navigation').toEqual([]);
  });

  test('settings hub has no dead /settings/* tabs', async ({ authedPage }) => {
    await authedPage.goto('/settings');
    const hubLinks = await authedPage
      .getByRole('main')
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''));

    const deadSettingsRoutes = hubLinks.filter(
      (href) => href.startsWith('/settings/') && href !== '/settings/providers'
    );
    expect(deadSettingsRoutes, 'only /settings/providers is a real settings sub-route').toEqual([]);
  });
});
