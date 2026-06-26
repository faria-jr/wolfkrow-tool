/**
 * Tipos e seletores compartilhados — usadas por helpers e specs.
 * Mantém o vocabulário de UI em um único lugar.
 */

import type { Page } from '@playwright/test';

export interface SessionMeta {
  id: string;
  title?: string;
  lastActivity: string;
  archived: boolean;
}

export interface ProviderRow {
  id: string;
  displayName: string;
  protocol: 'anthropic-compat' | 'openai-compatible';
  baseUrl: string;
  apiKeyAccount: string;
  models: readonly string[];
  supportsTools: boolean;
}

export const SELECTORS = {
  login: {
    passwordInput: 'input[type="password"][autocomplete="current-password"]',
    submitButton: 'button[type="submit"]',
    totpInput: 'input[inputmode="numeric"][maxlength="6"]',
    errorAlert: '[role="alert"]',
    onboardingLink: 'a[href="/onboarding"]',
  },
  onboarding: {
    password: 'input[type="password"][autocomplete="new-password"]',
    displayName: 'input[placeholder="Your name"]',
    submit: 'button[type="submit"]',
    providerSelect: '#provider-select',
    apiKeyInput: '#api-key-input',
    skipProvider: 'button:has-text("Skip")',
  },
  chat: {
    sidebar: 'aside',
    newChatButton: 'button:has-text("+ New Chat")',
    sessionButton: 'aside button[role], aside button',
    messageInput: 'textarea[aria-label="Chat input"]',
    sendButton: 'button[aria-label="Send"]',
    stopButton: 'button[aria-label="Stop"]',
    clearButton: 'header button:has-text("Clear")',
    attachmentDropzone: '[data-testid="attachment-dropzone"]',
    attachmentPreviews: '[data-testid="attachment-previews"]',
    userMessage: '[data-role="user"]',
    assistantMessage: '[data-role="assistant"]',
    streamIndicator: '[role="status"][aria-label="AI is typing"]',
    emptyState: 'text=Start a conversation',
  },
  providers: {
    addButton: 'button:has-text("Add provider")',
    displayName: 'input[name="displayName"]',
    baseUrl: 'input[name="baseUrl"]',
    apiKeyAccount: 'input[name="apiKeyAccount"]',
    apiKey: 'input[name="apiKey"]',
    modelInput: 'input[aria-label="Models"]',
    addModel: 'button:has-text("Add model")',
    supportsToolsSwitch: 'button[role="switch"]',
    saveButton: 'dialog button:has-text("Save")',
    cancelButton: 'dialog button:has-text("Cancel")',
    editButton: 'button:has-text("Edit"), button:has-text("Override")',
    deleteButton: 'button:has-text("Delete"):not(dialog *)',
    confirmDelete: '[role="dialog"] button:has-text("Delete")',
  },
  vault: {
    addSecretButton: 'button:has-text("Add Secret")',
    keyInput: 'input[placeholder*="Key"]',
    valueInput: 'input[placeholder="Value"]',
    displayNameInput: 'input[placeholder="Display Name"]',
    saveButton: 'button:has-text("Save"):not(:has-text("Saving"))',
    deleteButton: 'table button:has-text("Delete")',
    showButton: 'button:has-text("Show")',
  },
  settings: {
    providersCard: 'a[href="/settings/providers"]',
    vaultCard: 'a[href="/vault"]',
    agentsCard: 'a[href="/agents"]',
  },
} as const;

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export async function waitForUrl(page: Page, pattern: RegExp): Promise<void> {
  await page.waitForURL(pattern, { timeout: 15_000 });
}
