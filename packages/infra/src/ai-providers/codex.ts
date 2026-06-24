/**
 * CodexProvider — OpenAI models (GPT-4o, o1, o3, etc.) via OpenAI SDK.
 */

import OpenAI from 'openai';

import { OpenAIBaseProvider } from './openai-base';
import { assertPublicProviderHost } from './ssrf-guard';

export class CodexProvider extends OpenAIBaseProvider {
  private readonly baseURL: string | undefined;
  private ssrfPromise: Promise<void> | undefined;

  constructor(apiKey: string, baseURL?: string) {
    super(new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }));
    this.baseURL = baseURL;
  }

  protected override async ensureSsrfSafe(): Promise<void> {
    if (!this.baseURL) return;
    if (!this.ssrfPromise) {
      this.ssrfPromise = assertPublicProviderHost(this.baseURL);
    }
    return this.ssrfPromise;
  }
}
