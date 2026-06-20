# ADR-0022: Playwright para Testes E2E

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

Precisamos de testes E2E que validem fluxos completos:
- Login + TOTP
- Send message + streaming
- Upload document + search
- Pipeline BuildPlan flow
- Voice conversation
- Multi-tab sync

Vitest não roda browser. Precisamos de ferramenta dedicada.

## Decisão

**Playwright** para E2E + Visual Regression.

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Exemplo: Chat Flow

```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Password').fill('test-password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/chat');
  });
  
  test('user can send a message and receive streaming response', async ({ page }) => {
    await page.goto('/chat');
    
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('Hello, world!');
    await input.press('Enter');
    
    // Wait for streaming to start
    await expect(page.getByTestId('streaming-indicator')).toBeVisible();
    
    // Wait for response
    await expect(page.getByText('Hello! How can I help you today?')).toBeVisible({ timeout: 10_000 });
    
    // Streaming should end
    await expect(page.getByTestId('streaming-indicator')).not.toBeVisible();
  });
  
  test('user can abort streaming', async ({ page }) => {
    await page.goto('/chat');
    
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('Tell me a long story...');
    await input.press('Enter');
    
    await expect(page.getByTestId('streaming-indicator')).toBeVisible();
    
    await page.getByRole('button', { name: 'Stop' }).click();
    
    await expect(page.getByTestId('streaming-indicator')).not.toBeVisible();
  });
});
```

### Visual Regression

```typescript
// e2e/visual/pages.spec.ts
test('agents page visual', async ({ page }) => {
  await page.goto('/agents');
  await expect(page).toHaveScreenshot('agents-page.png', {
    fullPage: true,
    maxDiffPixels: 100,
  });
});

test('chat dark mode visual', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/chat');
  await expect(page).toHaveScreenshot('chat-dark.png', {
    fullPage: true,
  });
});
```

## Consequências

### Positivas

- **Cross-browser**: Chrome, Firefox, Safari (Webkit)
- **Auto-wait**: espera elements automaticamente
- **Trace viewer**: debug visual de failures
- **Visual regression**: detecta mudanças visuais
- **Parallel execution**: testes rodam em paralelo
- **Mobile emulation**: testa responsive
- **Network mocking**: simula offline, latency

### Negativas

- **Bundle size**: Playwright binary ~300MB
- **Flaky tests**: timing issues (mitigado por auto-wait)
- **CI time**: testes E2E são lentos (10-30s cada)

### Mitigações

- Auto-wait + retries reduzem flakiness
- Parallel execution + workers reduzem tempo
- Trace viewer para debug

## Cenários E2E Críticos

| Cenário | Por quê crítico |
|---|---|
| `auth.spec.ts` | Security |
| `chat.spec.ts` | Core feature |
| `pipeline.spec.ts` | Multi-stage flow |
| `harness.spec.ts` | Long-running async |
| `voice.spec.ts` | Media APIs |
| `knowledge.spec.ts` | Upload + vector search |
| `scheduler.spec.ts` | Cron timing |
| `wrapper.spec.ts` | Electron integration |

## Alternativas Consideradas

### A. Cypress

**Prós**: UI mode poderoso, DX excelente
**Contras**: Sem multi-browser, sem Webkit/Safari
**Decisão**: ❌ Rejeitado — Playwright é melhor

### B. Puppeteer

**Prós**: Chrome-only, leve
**Contras**: Sem multi-browser, menos features
**Decisão**: ❌ Rejeitado

### C. Selenium

**Prós**: Padrão antigo
**Contras**: Lento, frgil, sem modern features
**Decisão**: ❌ Rejeitado

## References

- [Playwright](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Visual Regression Testing](https://playwright.dev/docs/test-snapshots)
