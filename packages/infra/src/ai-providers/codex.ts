/**
 * CodexProvider — OpenAI models (GPT-4o, o1, o3, etc.) via OpenAI SDK.
 */

import OpenAI from 'openai';

import { OpenAIBaseProvider } from './openai-base';
import { assertPublicProviderHost } from './ssrf-guard';

export class CodexProvider extends OpenAIBaseProvider {
  private readonly baseURL: string | undefined;
  private ssrfChecked = false;

  constructor(apiKey: string, baseURL?: string) {
    super(new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }));
    this.baseURL = baseURL;
  }

  protected override async ensureSsrfSafe(): Promise<void> {
    if (this.ssrfChecked || !this.baseURL) return;
    this.ssrfChecked = true;
    await assertPublicProviderHost(this.baseURL);
  }
}
