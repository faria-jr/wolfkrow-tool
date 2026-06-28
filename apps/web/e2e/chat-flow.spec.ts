import type { Page } from '@playwright/test';

import { SELECTORS } from './helpers/selectors';
import { mockChatSessions, mockChatStream, mockToolPermissionResolve } from './helpers/sse-mock';
import { expect, test } from './helpers/test-fixtures';

/**
 * Chat flow — valida todas as iterações de chat:
 *  - Criação / seleção / exclusão de sessões.
 *  - Envio de mensagem + renderização de streaming SSE (ack → deltas → done).
 *  - Botão Stop (cancela o stream em andamento).
 *  - Confirmação de Clear chat.
 *  - Tool permission (approve e deny).
 *  - Attachments: tipos aceitos, limite de tamanho, remoção de previews.
 *  - Múltiplas mensagens em sequência.
 */

async function sendMessage(page: Page, text: string): Promise<void> {
  await page.locator(SELECTORS.chat.messageInput).fill(text);
  await page.locator(SELECTORS.chat.sendButton).click();
}

test.describe('Chat — sessions', () => {
  test('empty sidebar shows placeholder text', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await authedPage.goto('/chat');
    await expect(authedPage.getByText(/no sessions yet/i)).toBeVisible();
  });

  test('sidebar lists existing sessions in order', async ({ authedPage }) => {
    await mockChatSessions(authedPage, [
      { id: 'sess-1', title: 'First conversation' },
      { id: 'sess-2', title: 'Second conversation' },
    ]);
    await authedPage.goto('/chat');
    await expect(authedPage.getByText('First conversation')).toBeVisible();
    await expect(authedPage.getByText('Second conversation')).toBeVisible();
  });

  test('clicking a session selects it (active state)', async ({ authedPage }) => {
    await mockChatSessions(authedPage, [
      { id: 'sess-A', title: 'Session A' },
      { id: 'sess-B', title: 'Session B' },
    ]);
    await authedPage.goto('/chat');
    const sessionA = authedPage.getByRole('button', { name: /session a/i }).first();
    await sessionA.click();
    await expect(sessionA).toHaveClass(/bg-primary/);
  });

  test('new chat creates a fresh session in sidebar', async ({ authedPage }) => {
    let postCalls = 0;
    await authedPage.route('**/api/chat/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        postCalls += 1;
        const body = {
          id: `sess-${postCalls}`,
          title: 'New Chat',
          lastActivity: new Date().toISOString(),
          archived: false,
        };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });
    await authedPage.goto('/chat');
    await authedPage.locator(SELECTORS.chat.newChatButton).click();
    expect(postCalls).toBe(1);
  });

  test('delete session — confirms via window.confirm and removes from list', async ({
    authedPage,
  }) => {
    await mockChatSessions(authedPage, [
      { id: 'sess-X', title: 'Session X' },
      { id: 'sess-Y', title: 'Session Y' },
    ]);
    let deleted = false;
    await authedPage.route('**/api/chat/sessions/sess-X', async (route) => {
      deleted = true;
      await route.fulfill({ status: 204 });
    });
    authedPage.on('dialog', (d) => d.accept());
    await authedPage.goto('/chat');
    const sessionX = authedPage.getByRole('button', { name: /session x/i }).first();
    await sessionX.hover();
    await sessionX.getByRole('button', { name: /delete session/i }).click({ force: true });
    await expect.poll(() => deleted).toBe(true);
  });
});

test.describe('Chat — streaming send', () => {
  test('sending a message renders user + assistant bubbles', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { deltas: ['Hi', ' there'] });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'Hello');
    await expect(authedPage.locator(SELECTORS.chat.userMessage)).toContainText('Hello');
    await expect(authedPage.locator(SELECTORS.chat.assistantMessage)).toContainText(/Hi there/);
  });

  test('stream indicator is visible during streaming', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { deltas: ['Slow', ' response'], delayMsPerDelta: 80 });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'Hello');
    await expect(authedPage.locator(SELECTORS.chat.streamIndicator)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('stream indicator disappears when stream completes', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { deltas: ['Quick'] });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'Hi');
    await expect(authedPage.locator(SELECTORS.chat.streamIndicator)).toBeHidden({
      timeout: 10_000,
    });
  });

  test('stop button aborts an in-flight stream', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    let aborted = false;
    await authedPage.route('**/chat/send', async (route) => {
      const ac = new AbortController();
      const reqSignal = (route.request() as unknown as { signal?: AbortSignal }).signal;
      reqSignal?.addEventListener?.('abort', () => {
        aborted = true;
        ac.abort();
      });
      const chunks = [
        'data: ' + JSON.stringify({ type: 'ack' }) + '\n\n',
        'data: ' + JSON.stringify({ type: 'text', content: 'Part1' }) + '\n\n',
      ].join('');
      try {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 5_000);
          ac.signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error('aborted'));
          });
        });
      } catch {
        await route.abort('aborted');
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: chunks,
      });
    });

    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'go');
    await expect(authedPage.locator(SELECTORS.chat.stopButton)).toBeVisible({ timeout: 3_000 });
    await authedPage.locator(SELECTORS.chat.stopButton).click();
    await expect.poll(() => aborted).toBe(true);
  });

  test('clear chat asks for confirmation then resets state', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { deltas: ['Reply'] });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'Test');
    await expect(authedPage.locator(SELECTORS.chat.userMessage)).toBeVisible();
    await authedPage.locator(SELECTORS.chat.clearButton).click();
    const dialog = authedPage.getByRole('alertdialog');
    await dialog.getByRole('button', { name: /confirm/i }).click();
    await expect(authedPage.locator(SELECTORS.chat.emptyState)).toBeVisible();
  });

  test('multiple sequential messages render in order', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { deltas: ['Reply 1'] });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'Q1');
    await expect(authedPage.locator(SELECTORS.chat.assistantMessage).last()).toContainText(
      'Reply 1'
    );
    await sendMessage(authedPage, 'Q2');
    const assistants = authedPage.locator(SELECTORS.chat.assistantMessage);
    await expect(assistants).toHaveCount(2);
  });

  test('error from worker surfaces as assistant error message', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { failWith: 'provider unreachable' });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'hi');
    await expect(authedPage.locator(SELECTORS.chat.assistantMessage)).toContainText(
      /error|could not connect/i,
      { timeout: 10_000 }
    );
  });
});

test.describe('Chat — tool permission', () => {
  const TOOL_OPTS = {
    toolCall: {
      id: 'call-1',
      name: 'execute_command',
      input: { cmd: 'rm -rf /tmp/test' },
      output: 'would have run: rm -rf /tmp/test',
      prompt: 'The agent wants to run a destructive command. Approve?',
    },
  };

  test('permission prompt is shown for tool calls', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, TOOL_OPTS);
    await mockToolPermissionResolve(authedPage, true);
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'delete tmp');
    const dialog = authedPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/allow tool.*execute_command/i)).toBeVisible();
  });

  test('approving permission resolves the prompt', async ({ authedPage }) => {
    let approvePosted = false;
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, TOOL_OPTS);
    await authedPage.route('**/chat/permission', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      if (body['approved'] === true) approvePosted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resolved: true }),
      });
    });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'delete tmp');
    const dialog = authedPage.getByRole('alertdialog');
    await dialog.getByRole('button', { name: /confirm/i }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => approvePosted).toBe(true);
  });

  test('denying permission posts approved=false', async ({ authedPage }) => {
    let denied = false;
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, TOOL_OPTS);
    await authedPage.route('**/chat/permission', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      if (body['approved'] === false) denied = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resolved: true }),
      });
    });
    await authedPage.goto('/chat');
    await sendMessage(authedPage, 'delete tmp');
    const dialog = authedPage.getByRole('alertdialog');
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect.poll(() => denied).toBe(true);
  });
});

test.describe('Chat — attachments', () => {
  test('attaching a PNG file shows preview chip', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await mockChatStream(authedPage, { deltas: ['Got it'] });
    await authedPage.goto('/chat');
    const png = Buffer.from('89504E470D0A1A0A0000000D49484452', 'hex');
    await authedPage.locator('input[type="file"]').first().setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await expect(authedPage.locator(SELECTORS.chat.attachmentPreviews)).toContainText('pixel.png');
  });

  test('removing an attachment preview hides the chip', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await authedPage.goto('/chat');
    const png = Buffer.from('89504E470D0A1A0A', 'hex');
    await authedPage.locator('input[type="file"]').first().setInputFiles({
      name: 'tmp.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await expect(authedPage.locator(SELECTORS.chat.attachmentPreviews)).toBeVisible();
    await authedPage.getByRole('button', { name: /remove tmp\.png/i }).click();
    await expect(authedPage.locator(SELECTORS.chat.attachmentPreviews)).toBeHidden();
  });

  test('unsupported MIME type surfaces an inline error', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await authedPage.goto('/chat');
    await authedPage
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: 'bad.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('MZ'),
      });
    await expect(
      authedPage
        .getByRole('alert')
        .filter({ hasText: /tipo|não suportado|not supported/i })
        .first()
    ).toBeVisible();
  });

  test('oversized attachment (>5MB) is rejected with inline error', async ({ authedPage }) => {
    await mockChatSessions(authedPage, []);
    await authedPage.goto('/chat');
    const big = Buffer.alloc(6 * 1024 * 1024, 0);
    await authedPage.locator('input[type="file"]').first().setInputFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: big,
    });
    await expect(
      authedPage
        .getByRole('alert')
        .filter({ hasText: /excede|limit|5 ?mb/i })
        .first()
    ).toBeVisible();
  });
});
