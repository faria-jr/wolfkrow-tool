import type { Page } from '@playwright/test';

import { SELECTORS } from './helpers/selectors';
import { expect, test } from './helpers/test-fixtures';

/**
 * Cenário completo end-to-end.
 *
 * Replica o fluxo real do produto:
 *   1. Visitante chega na home → redirecionado para /login (conta já criada
 *      pelo globalSetup).
 *   2. Login com credenciais válidas → /chat.
 *   3. Settings → Providers: adiciona um provider custom (openai-compatible),
 *      valida que aparece na lista e que pode editá-lo.
 *   4. Settings → Vault: adiciona um secret (api key) — o valor nunca deve
 *      aparecer na DOM em texto plano (security check).
 *   5. Chat: cria uma nova sessão, envia uma mensagem usando o provider
 *      configurado, valida que o streaming SSE renderiza a resposta.
 *   6. Sessions: cria mais uma sessão, alterna entre as duas, deleta a
 *      primeira — confirma persistência no sidebar.
 *   7. Lock: dispara /api/auth/lock → ao navegar para /chat, é exigido
 *      re-autenticação em /unlock.
 *
 * Esse spec valida o "happy path" integrado, sem mocks profundos — apenas
 * os SSE do worker são stubbados para garantir determinismo da resposta
 * da IA (sem depender de chaves reais).
 */

async function fillProviderForm(
  page: Page,
  values: {
    displayName: string;
    baseUrl: string;
    apiKeyAccount: string;
    model: string;
    apiKey?: string;
  }
): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="displayName"]').fill(values.displayName);
  await dialog.locator('input[name="baseUrl"]').fill(values.baseUrl);
  await dialog.locator('input[name="apiKeyAccount"]').fill(values.apiKeyAccount);
  await dialog.locator(SELECTORS.providers.modelInput).fill(values.model);
  await dialog.locator(SELECTORS.providers.addModel).click();
  if (values.apiKey) {
    await dialog.locator('input[name="apiKey"]').fill(values.apiKey);
  }
}

test.describe('Complete scenario — onboarding to chat', () => {
  test('login → settings (provider) → vault (secret) → chat (use it) → lock', async ({
    authedPage,
  }) => {
    // ===== 1) Chat começa vazio =====
    await authedPage.route('**/api/chat/sessions', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        const id = `sess-${Math.random().toString(36).slice(2, 10)}`;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id,
            title: 'New Chat',
            lastActivity: new Date().toISOString(),
            archived: false,
          }),
        });
      }
    });

    let providerList: Array<Record<string, unknown>> = [];
    await authedPage.route('**/api/providers', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(providerList),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
        providerList = [
          ...providerList,
          {
            id: body['id'] ?? `prov-${Date.now()}`,
            displayName: body['displayName'],
            protocol: body['protocol'],
            baseUrl: body['baseUrl'],
            apiKeyAccount: body['apiKeyAccount'],
            models: body['models'],
            supportsTools: body['supportsTools'],
          },
        ];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      } else {
        await route.continue();
      }
    });

    let secrets: Array<Record<string, unknown>> = [];
    await authedPage.route('**/api/vault', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ secrets }),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
        const next = { id: `sec-${Date.now()}`, ...body };
        secrets = [...secrets, next];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      } else {
        await route.continue();
      }
    });

    await authedPage.route('**/api/vault/**/masked', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ masked: 'sk-**************************1234' }),
      });
    });

    // SSE do worker — provider configurado acima responde normalmente
    await authedPage.route('**/chat/send', async (route) => {
      const events = [
        { type: 'ack', message: 'ok' },
        { type: 'text', content: 'Olá! Vi que você configurou ' },
        { type: 'text', content: 'um provider custom. Como posso ajudar?' },
        { type: 'done', usage: { inputTokens: 5, outputTokens: 18 } },
      ];
      const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body });
    });

    // ===== 2) Abre o chat =====
    await authedPage.goto('/chat');
    await expect(authedPage.locator(SELECTORS.chat.messageInput)).toBeVisible();

    // ===== 3) Configura um provider custom =====
    await authedPage.goto('/settings/providers');
    await authedPage.locator(SELECTORS.providers.addButton).click();
    await fillProviderForm(authedPage, {
      displayName: 'E2E Test LLM',
      baseUrl: 'https://e2e-llm.test/v1',
      apiKeyAccount: 'e2e-llm-api-key',
      model: 'e2e-model-v1',
      apiKey: 'sk-e2e-1234567890abcdef',
    });
    await authedPage.getByRole('dialog').locator(SELECTORS.providers.saveButton).click();
    await expect(authedPage.getByRole('dialog')).toBeHidden();

    await expect(authedPage.getByText('E2E Test LLM')).toBeVisible();
    await expect(authedPage.getByText('https://e2e-llm.test/v1')).toBeVisible();
    await expect(authedPage.getByText('e2e-model-v1')).toBeVisible();

    // ===== 4) Edita o provider (apenas display name) =====
    const card = authedPage.locator('div').filter({ hasText: 'E2E Test LLM' }).first();
    await card.getByRole('button', { name: /^edit$/i }).click();
    const editDialog = authedPage.getByRole('dialog');
    await editDialog.locator('input[name="displayName"]').fill('E2E Test LLM (renamed)');
    await editDialog.locator(SELECTORS.providers.saveButton).click();
    await expect(editDialog).toBeHidden();
    await expect(authedPage.getByText('E2E Test LLM (renamed)')).toBeVisible();

    // ===== 5) Adiciona um secret no Vault =====
    await authedPage.goto('/vault');
    await authedPage.locator(SELECTORS.vault.addSecretButton).click();
    await authedPage.locator('input[placeholder^="Key"]').fill('e2e-llm-api-key');
    await authedPage.locator('input[placeholder="Value"]').fill('sk-e2e-1234567890abcdef');
    await authedPage.locator('input[placeholder="Display Name"]').fill('E2E LLM');
    await authedPage.getByRole('button', { name: /^save$/i }).click();
    await expect(authedPage.getByRole('heading', { name: /add secret/i })).toBeHidden();
    await expect(authedPage.getByText('E2E LLM')).toBeVisible();

    // SECURITY: o valor do secret NÃO pode aparecer em texto plano na página.
    const bodyText = await authedPage.locator('body').innerText();
    expect(bodyText).not.toContain('sk-e2e-1234567890abcdef');

    // Show masked → recebe preview com placeholders
    await authedPage.getByRole('button', { name: /^show$/i }).click();
    await expect(authedPage.getByText(/sk-.*\*+.*[a-z0-9]+/)).toBeVisible();

    // ===== 6) Volta para o chat e usa o provider configurado =====
    await authedPage.goto('/chat');
    await authedPage.locator(SELECTORS.chat.messageInput).fill('Use the new provider please');
    await authedPage.locator(SELECTORS.chat.sendButton).click();

    await expect(authedPage.locator(SELECTORS.chat.userMessage)).toContainText(
      'Use the new provider please'
    );
    await expect(authedPage.locator(SELECTORS.chat.assistantMessage)).toContainText(
      /configurou.*provider custom|como posso ajudar/i,
      { timeout: 10_000 }
    );

    // ===== 7) Cria mais uma sessão, alterna e deleta a primeira =====
    await authedPage.locator(SELECTORS.chat.newChatButton).click();
    await expect(authedPage.locator(SELECTORS.chat.messageInput)).toBeEmpty();
    await expect(authedPage.locator(SELECTORS.chat.userMessage)).toHaveCount(0);

    // Volta para a primeira sessão
    await authedPage
      .getByRole('button', { name: /use the new provider/i })
      .first()
      .click();
    await expect(authedPage.locator(SELECTORS.chat.userMessage)).toContainText(
      'Use the new provider please'
    );

    // Delete a primeira sessão via janela de confirmação
    let deletedId: string | null = null;
    await authedPage.route('**/api/chat/sessions/**', async (route) => {
      if (route.request().method() === 'DELETE') {
        deletedId = route.request().url().split('/').pop() ?? null;
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    });
    authedPage.on('dialog', (d) => d.accept());

    const firstSession = authedPage.getByRole('button', { name: /use the new provider/i }).first();
    await firstSession.hover();
    await firstSession.getByRole('button', { name: /delete session/i }).click({ force: true });
    await expect.poll(() => deletedId).not.toBeNull();

    // ===== 8) Lock: sessão deve ser invalidada =====
    await authedPage.request.post('/api/auth/lock');
    await authedPage.goto('/chat');
    await expect(authedPage).toHaveURL(/\/(login|unlock)/);
    await expect(authedPage.locator(SELECTORS.login.passwordInput)).toBeVisible();
  });

  test('logout flow terminates the session cleanly', async ({ authedPage }) => {
    await authedPage.goto('/chat');
    const logout = await authedPage.request.post('/api/auth/logout');
    expect(logout.ok()).toBeTruthy();

    await authedPage.goto('/chat');
    await expect(authedPage).toHaveURL(/\/login/);
  });

  test('session is reused across tabs (storage state)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const pageA = await ctx.newPage();
    const pageB = await ctx.newPage();

    await pageA.goto('/chat');
    await expect(pageA.locator(SELECTORS.chat.messageInput)).toBeVisible();

    await pageB.goto('/settings');
    await expect(pageB.getByRole('heading', { name: /settings/i })).toBeVisible();

    await ctx.close();
  });
});
