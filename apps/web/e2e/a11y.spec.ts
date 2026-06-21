import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  { name: 'Login', path: '/login' },
  { name: 'Chat', path: '/chat' },
  { name: 'Tasks', path: '/tasks' },
  { name: 'Knowledge', path: '/knowledge' },
  { name: 'Settings', path: '/settings' },
];

for (const { name, path } of PAGES) {
  test(`${name} page has no critical a11y violations`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude(['[data-testid="skip-a11y"]'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical, `Critical a11y violations on ${name}:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });
}
