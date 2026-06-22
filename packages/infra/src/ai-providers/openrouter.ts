import OpenAI from 'openai';

import { OpenAIBaseProvider } from './openai-base';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouterProvider — routes requests through openrouter.ai.
 * Covers google/, groq/, mistral/, together/, openrouter/ model prefixes.
 */
export class OpenRouterProvider extends OpenAIBaseProvider {
  constructor(apiKey: string) {
    super(new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL }));
  }
}
