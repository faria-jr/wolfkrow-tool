/**
 * ClaudeCompatProvider — Anthropic via OpenAI-compatible endpoint.
 * Usa OpenAI SDK apontando para api.anthropic.com/v1.
 * Útil para clients que só conhecem o protocolo OpenAI.
 */

import OpenAI from 'openai';

import { OpenAIBaseProvider } from './openai-base';

const ANTHROPIC_COMPAT_URL = 'https://api.anthropic.com/v1';

export class ClaudeCompatProvider extends OpenAIBaseProvider {
  constructor(apiKey: string) {
    super(
      new OpenAI({
        apiKey,
        baseURL: ANTHROPIC_COMPAT_URL,
        defaultHeaders: {
          'anthropic-version': '2023-06-01',
        },
      }),
    );
  }
}
