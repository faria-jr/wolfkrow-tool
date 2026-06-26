/**
 * SSE mock helpers — interceptam chamadas ao worker (`/chat/send`,
 * `/chat/permission`) para tornar os testes determinísticos sem depender
 * de providers reais (Anthropic, OpenAI, etc).
 *
 * Estratégia:
 *  - `mockChatStream`: responde ao POST /chat/send com um SSE simulado
 *    (ack → text deltas → tool_call → done) controlado pelo test runner.
 *  - `mockProviders`: stub /api/providers e /api/providers/:id com fixtures.
 *  - `mockVault`: stub /api/vault para cenários de Vault isolados.
 *
 * Para testes "híbridos", basta NÃO mockar — a chamada real é preservada
 * e o worker responde com erro de provider (que também é coberto).
 */

import type { Page, Route } from '@playwright/test';

const WORKER_URL = process.env['NEXT_PUBLIC_WORKER_URL'] ?? 'http://localhost:4000';
const WEB_BASE = process.env['BASE_URL'] ?? 'http://localhost:3000';

function sseEncode(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}export interface MockChatOptions {
  deltas?: readonly string[];
  toolCall?: { id: string; name: string; input: Record<string, unknown>; prompt: string; output?: string };
  finalUsage?: { inputTokens: number; outputTokens: number };
  delayMsPerDelta?: number;
  failWith?: string;
}

export async function mockChatStream(page: Page, opts: MockChatOptions = {}): Promise<void> {
  const deltas = opts.deltas ?? ['Hello', ', ', 'world', '!'];
  const delay = opts.delayMsPerDelta ?? 30;

  await page.route(`${WORKER_URL}/chat/send`, async (route: Route) => {
    if (opts.failWith) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: opts.failWith }),
      });
      return;
    }

    const events: Array<Record<string, unknown>> = [{ type: 'ack', message: 'ok' }];

    if (opts.toolCall) {
      const { id, name, input, prompt } = opts.toolCall;
      events.push({ type: 'tool_permission', id, name, input, prompt });
    }

    for (const d of deltas) {
      events.push({ type: 'text', content: d });
    }

    if (opts.toolCall) {
      events.push({ type: 'tool_call', id: opts.toolCall.id, name: opts.toolCall.name, input: opts.toolCall.input });
      events.push({ type: 'tool_result', callId: opts.toolCall.id, output: opts.toolCall.output ?? '', isError: false });
    }

    events.push({
      type: 'done',
      usage: opts.finalUsage ?? { inputTokens: 12, outputTokens: deltas.join('').length / 2 },
    });

    const chunks = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: chunks,
    });
  });
}

export async function mockToolPermissionResolve(page: Page, approve = true): Promise<void> {
  await page.route(`${WORKER_URL}/chat/permission`, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resolved: approve }) });
  });
}

export async function mockChatSessions(page: Page, sessions: ReadonlyArray<{ id: string; title?: string }> = []): Promise<void> {
  const data = sessions.map((s, i) => ({
    id: s.id,
    title: s.title ?? `Session ${i + 1}`,
    lastActivity: new Date(Date.now() - i * 60_000).toISOString(),
    archived: false,
  }));
  await page.route(`${WEB_BASE}/api/chat/sessions`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    } else if (route.request().method() === 'POST') {
      const id = `sess-${Math.random().toString(36).slice(2, 10)}`;
      const body = { id, title: 'New Chat', lastActivity: new Date().toISOString(), archived: false };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
    } else {
      await route.continue();
    }
  });
}

export async function mockProviders(page: Page, providers: ReadonlyArray<Record<string, unknown>>): Promise<void> {
  await page.route(`${WEB_BASE}/api/providers`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(providers) });
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
  });
}

export async function mockVault(page: Page, secrets: ReadonlyArray<Record<string, unknown>> = []): Promise<void> {
  await page.route(`${WEB_BASE}/api/vault`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secrets }) });
    } else if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      const next = { id: `sec-${Date.now()}`, ...body };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, secret: next }) });
    } else {
      await route.continue();
    }
  });
}

export function chunkedSse(events: ReadonlyArray<Record<string, unknown>>): string {
  return sseEncode(events);
}
