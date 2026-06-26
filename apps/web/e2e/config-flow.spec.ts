import { SELECTORS } from './helpers/selectors';
import { mockProviders, mockVault } from './helpers/sse-mock';
import { expect, test } from './helpers/test-fixtures';

/**
 * Settings & Configuration flows.
 *
 * Cobre:
 *  - Hub de Settings (cards de navegação para sub-áreas).
 *  - Providers: listagem built-in + custom, criar, editar (override built-in),
 *    deletar (com confirmação), validações de formulário, persistência.
 *  - Vault: lista de secrets, adicionar (form completo), show (masked),
 *    delete com confirm, export/import stub.
 *
 * Os mocks isolam o teste do worker real — esses testes validam exclusivamente
 * a UI da web. Para validar a persistência end-to-end, ver
 * complete-scenario.spec.ts.
 */

interface ProviderRow {
  id: string;
  displayName: string;
  protocol: 'anthropic-compat' | 'openai-compatible';
  baseUrl: string;
  apiKeyAccount: string;
  models: readonly string[];
  supportsTools: boolean;
}

const BUILT_IN_AI: ProviderRow = {
  id: 'anthropic',
  displayName: 'Anthropic (Claude)',
  protocol: 'anthropic-compat',
  baseUrl: 'https://api.anthropic.com',
  apiKeyAccount: 'anthropic',
  models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  supportsTools: true,
};

const BUILT_IN_OPENAI: ProviderRow = {
  id: 'openai',
  displayName: 'OpenAI',
  protocol: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKeyAccount: 'openai',
  models: ['gpt-4o', 'o3'],
  supportsTools: true,
};

function providerAsRecord(p: ProviderRow): Record<string, unknown> {
  return { ...p };
}

test.describe('Settings — hub', () => {
  test('renders all navigation cards', async ({ authedPage }) => {
    await authedPage.goto('/settings');
    const cards = [
      'Providers', 'Vault', 'Agents', 'MCP Servers',
      'Scheduler', 'Rules', 'Permissions', 'Channels', 'Usage',
    ];
    for (const label of cards) {
      await expect(authedPage.getByRole('link', { name: new RegExp(label, 'i') })).toBeVisible();
    }
  });

  test('navigates to providers settings', async ({ authedPage }) => {
    await authedPage.goto('/settings');
    await authedPage.locator(SELECTORS.settings.providersCard).click();
    await expect(authedPage).toHaveURL(/\/settings\/providers/);
  });

  test('navigates to vault', async ({ authedPage }) => {
    await authedPage.goto('/settings');
    await authedPage.locator(SELECTORS.settings.vaultCard).click();
    await expect(authedPage).toHaveURL(/\/vault/);
  });
});

test.describe('Providers configuration', () => {
  test('lists built-in providers with "Built-in" badge', async ({ authedPage }) => {
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI), providerAsRecord(BUILT_IN_OPENAI)]);
    await authedPage.goto('/settings/providers');
    await expect(authedPage.getByText(BUILT_IN_AI.displayName)).toBeVisible();
    await expect(authedPage.getByText(BUILT_IN_OPENAI.displayName)).toBeVisible();
    const builtInBadges = authedPage.getByText('Built-in', { exact: true });
    await expect(builtInBadges).toHaveCount(2);
  });

  test('built-in providers show "Override" instead of "Edit" and no Delete', async ({ authedPage }) => {
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI)]);
    await authedPage.goto('/settings/providers');
    await expect(authedPage.getByRole('button', { name: /^override$/i })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /^delete$/i })).toHaveCount(0);
  });

  test('custom providers show "Edit" + "Delete" buttons', async ({ authedPage }) => {
    const custom: ProviderRow = {
      id: 'custom-e2e-1',
      displayName: 'Custom E2E Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.test/v1',
      apiKeyAccount: 'custom-e2e-1',
      models: ['test-model-1'],
      supportsTools: false,
    };
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI), providerAsRecord(custom)]);
    await authedPage.goto('/settings/providers');
    const card = authedPage.locator('[class*="rounded-lg"][class*="border"]').filter({ hasText: custom.displayName });
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible();
    await expect(card.getByRole('button', { name: /^delete$/i })).toBeVisible();
  });

  test('add provider opens modal with empty form', async ({ authedPage }) => {
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI)]);
    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();
    const dialog = authedPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Provider Configuration')).toBeVisible();
    await expect(dialog.locator(SELECTORS.providers.displayName)).toBeVisible();
  });

  test('add provider — fills form, adds models, saves successfully', async ({ authedPage }) => {
    let savedPayload: Record<string, unknown> | null = null;
    await authedPage.route('**/api/providers', async (route) => {
      if (route.request().method() === 'POST') {
        savedPayload = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BUILT_IN_AI]) });
      }
    });

    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();

    const dialog = authedPage.getByRole('dialog');
    await dialog.locator('input[name="displayName"]').fill('My E2E Provider');
    await dialog.locator('input[name="baseUrl"]').fill('https://my-e2e.test/v1');
    await dialog.locator('input[name="apiKeyAccount"]').fill('my-e2e-account');

    await dialog.locator(SELECTORS.providers.modelInput).fill('model-1');
    await dialog.locator(SELECTORS.providers.addModel).click();
    await dialog.locator(SELECTORS.providers.modelInput).fill('model-2');
    await dialog.locator(SELECTORS.providers.addModel).click();

    await dialog.locator('input[name="apiKey"]').fill('sk-test-key');
    await dialog.locator(SELECTORS.providers.saveButton).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    expect(savedPayload).not.toBeNull();
    expect(savedPayload).toMatchObject({
      displayName: 'My E2E Provider',
      baseUrl: 'https://my-e2e.test/v1',
      apiKeyAccount: 'my-e2e-account',
      apiKey: 'sk-test-key',
    });
    expect((savedPayload as unknown as { models: string[] }).models).toEqual(['model-1', 'model-2']);
  });

  test('add provider — validation rejects empty fields', async ({ authedPage }) => {
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI)]);
    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();

    const dialog = authedPage.getByRole('dialog');
    await dialog.locator(SELECTORS.providers.saveButton).click();
    await expect(dialog.getByText(/display name required/i)).toBeVisible();
    await expect(dialog.getByText(/must be a valid url/i)).toBeVisible();
    await expect(dialog.getByText(/api key account required/i)).toBeVisible();
    await expect(dialog.getByText(/at least one model required/i)).toBeVisible();
  });

  test('add provider — invalid URL is rejected', async ({ authedPage }) => {
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI)]);
    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();

    const dialog = authedPage.getByRole('dialog');
    await dialog.locator('input[name="displayName"]').fill('Invalid URL Provider');
    await dialog.locator('input[name="baseUrl"]').fill('not-a-url');
    await dialog.locator('input[name="apiKeyAccount"]').fill('acc');
    await dialog.locator(SELECTORS.providers.modelInput).fill('m1');
    await dialog.locator(SELECTORS.providers.addModel).click();
    await dialog.locator(SELECTORS.providers.saveButton).click();
    await expect(dialog.getByText(/must be a valid url/i)).toBeVisible();
  });

  test('cancel closes the add provider modal without saving', async ({ authedPage }) => {
    let postCount = 0;
    await authedPage.route('**/api/providers', async (route) => {
      if (route.request().method() === 'POST') postCount += 1;
      await route.fulfill({
        status: route.request().method() === 'POST' ? 201 : 200,
        contentType: 'application/json',
        body: JSON.stringify(route.request().method() === 'POST' ? { ok: true } : [BUILT_IN_AI]),
      });
    });
    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();
    const dialog = authedPage.getByRole('dialog');
    await dialog.locator(SELECTORS.providers.cancelButton).click();
    await expect(dialog).toBeHidden();
    expect(postCount).toBe(0);
  });

  test('delete provider — confirmation then removal', async ({ authedPage }) => {
    const custom: ProviderRow = {
      id: 'to-delete',
      displayName: 'To Delete Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://delete.test/v1',
      apiKeyAccount: 'to-delete',
      models: ['m1'],
      supportsTools: false,
    };
    let deleteCount = 0;
    let providers = [BUILT_IN_AI, custom];
    await authedPage.route('**/api/providers', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(providers) });
      } else if (method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        await route.continue();
      }
    });
    await authedPage.route('**/api/providers/to-delete', async (route) => {
      deleteCount += 1;
      providers = providers.filter((p) => p.id !== 'to-delete');
      await route.fulfill({ status: 204 });
    });

    await authedPage.goto('/settings/providers');
    const card = authedPage.locator('div').filter({ hasText: custom.displayName }).first();
    await card.getByRole('button', { name: /^delete$/i }).click();

    const confirm = authedPage.locator('[role="dialog"]');
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(custom.displayName)).toBeVisible();
    await confirm.getByRole('button', { name: /^delete$/i }).click();

    await expect(authedPage.getByText(custom.displayName)).toHaveCount(0);
    expect(deleteCount).toBe(1);
  });

  test('delete provider — cancel keeps the provider', async ({ authedPage }) => {
    const custom: ProviderRow = {
      id: 'keep-me',
      displayName: 'Keep Me Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://keep.test/v1',
      apiKeyAccount: 'keep-me',
      models: ['m1'],
      supportsTools: false,
    };
    await mockProviders(authedPage, [providerAsRecord(BUILT_IN_AI), providerAsRecord(custom)]);
    await authedPage.goto('/settings/providers');
    const card = authedPage.locator('div').filter({ hasText: custom.displayName }).first();
    await card.getByRole('button', { name: /^delete$/i }).click();
    const confirm = authedPage.locator('[role="dialog"]');
    await confirm.getByRole('button', { name: /cancel/i }).click();
    await expect(authedPage.getByText(custom.displayName)).toBeVisible();
  });

  test('save provider error surfaces a destructive banner', async ({ authedPage }) => {
    await authedPage.route('**/api/providers', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BUILT_IN_AI]) });
      } else {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate provider id' }) });
      }
    });

    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();
    const dialog = authedPage.getByRole('dialog');
    await dialog.locator('input[name="displayName"]').fill('Dup');
    await dialog.locator('input[name="baseUrl"]').fill('https://dup.test/v1');
    await dialog.locator('input[name="apiKeyAccount"]').fill('dup');
    await dialog.locator(SELECTORS.providers.modelInput).fill('m');
    await dialog.locator(SELECTORS.providers.addModel).click();
    await dialog.locator(SELECTORS.providers.saveButton).click();

    await expect(authedPage.getByText(/save failed.*duplicate provider id/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Vault configuration', () => {
  test('renders empty state when no secrets', async ({ authedPage }) => {
    await mockVault(authedPage, []);
    await authedPage.goto('/vault');
    await expect(authedPage.getByText(/no secrets stored/i)).toBeVisible();
    await expect(authedPage.getByText(/os keychain|secret service|credential vault/i)).toBeVisible();
  });

  test('lists existing secrets in table', async ({ authedPage }) => {
    await mockVault(authedPage, [
      { id: 's1', key: 'anthropic-api-key', displayName: 'Anthropic', category: 'ai', lastRotated: '2026-06-01' },
      { id: 's2', key: 'telegram-bot-token', displayName: 'Telegram', category: 'integration' },
    ]);
    await authedPage.goto('/vault');
    await expect(authedPage.getByText('Anthropic')).toBeVisible();
    await expect(authedPage.getByText('Telegram')).toBeVisible();
    await expect(authedPage.getByText('ai')).toBeVisible();
    await expect(authedPage.getByText('integration')).toBeVisible();
  });

  test('add secret — form validates required fields', async ({ authedPage }) => {
    await mockVault(authedPage, []);
    await authedPage.goto('/vault');
    await authedPage.locator(SELECTORS.vault.addSecretButton).click();
    await expect(authedPage.getByRole('heading', { name: /add secret/i })).toBeVisible();
    await expect(authedPage.locator(SELECTORS.vault.saveButton)).toBeDisabled();
  });

  test('add secret — full submission persists', async ({ authedPage }) => {
    let posted: Record<string, unknown> | null = null;
    await authedPage.route('**/api/vault', async (route) => {
      if (route.request().method() === 'POST') {
        posted = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secrets: [] }) });
      }
    });
    await authedPage.goto('/vault');
    await authedPage.locator(SELECTORS.vault.addSecretButton).click();
    await authedPage.locator('input[placeholder^="Key"]').fill('openai-api-key');
    await authedPage.locator('input[placeholder="Value"]').fill('sk-test');
    await authedPage.locator('input[placeholder="Display Name"]').fill('OpenAI');
    await authedPage.getByRole('button', { name: /^save$/i }).click();

    expect(posted).toMatchObject({ key: 'openai-api-key', value: 'sk-test', displayName: 'OpenAI', category: 'ai' });
    await expect(authedPage.getByRole('heading', { name: /add secret/i })).toBeHidden();
  });

  test('reveal masked secret — fetch shows masked preview', async ({ authedPage }) => {
    await mockVault(authedPage, [
      { id: 's1', key: 'anthropic-api-key', displayName: 'Anthropic', category: 'ai' },
    ]);
    await authedPage.route('**/api/vault/anthropic-api-key/masked', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ masked: 'sk-a***************************xyz' }) });
    });
    await authedPage.goto('/vault');
    await authedPage.getByRole('button', { name: /^show$/i }).click();
    await expect(authedPage.getByText('sk-a***xyz')).toBeVisible();
  });

  test('export backup — opens form and requires passphrase', async ({ authedPage }) => {
    await mockVault(authedPage, []);
    await authedPage.goto('/vault');
    await authedPage.getByRole('button', { name: /export backup/i }).click();
    await expect(authedPage.getByRole('heading', { name: /export encrypted backup/i })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /download backup/i })).toBeDisabled();
  });

  test('export backup — enabled with passphrase, hits endpoint', async ({ authedPage }) => {
    let exported = false;
    await authedPage.route('**/api/vault', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secrets: [] }) });
    });
    await authedPage.route('**/api/vault/export', async (route) => {
      exported = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payload: { ciphertext: 'x' } }) });
    });
    await authedPage.goto('/vault');
    await authedPage.getByRole('button', { name: /export backup/i }).click();
    await authedPage.locator('input[placeholder="Passphrase"]').fill('strong-pass-123');
    await authedPage.getByRole('button', { name: /download backup/i }).click();
    await expect.poll(() => exported).toBe(true);
  });

  test('delete secret — confirmation removes the row', async ({ authedPage }) => {
    let secrets = [
      { id: 's1', key: 'telegram-bot-token', displayName: 'Telegram', category: 'integration' },
    ];
    await authedPage.route('**/api/vault', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secrets }) });
      } else {
        await route.continue();
      }
    });
    await authedPage.route('**/api/vault/telegram-bot-token', async (route) => {
      secrets = [];
      await route.fulfill({ status: 204 });
    });
    authedPage.on('dialog', (d) => d.accept());
    await authedPage.goto('/vault');
    await authedPage.getByRole('button', { name: /^delete$/i }).click();
    await expect(authedPage.getByText('Telegram')).toHaveCount(0);
  });
});
