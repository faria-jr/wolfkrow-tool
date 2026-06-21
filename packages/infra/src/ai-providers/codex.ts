/**
 * CodexProvider — OpenAI models (GPT-4o, o1, o3, etc.) via OpenAI SDK.
 */

import OpenAI from 'openai';

import { OpenAIBaseProvider } from './openai-base';

export class CodexProvider extends OpenAIBaseProvider {
  constructor(apiKey: string, baseURL?: string) {
    super(new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }));
  }
}
