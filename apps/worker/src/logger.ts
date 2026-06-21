/**
 * Worker logger — H.2: Pino with secret redaction + correlation-id support.
 */

import pino from 'pino';

export type Logger = pino.Logger;

// H.2: Never log these fields — they may contain API keys, tokens, passwords.
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.value',
  'req.body.token',
  'body.password',
  'body.value',
  'body.token',
  'apiKey',
  'api_key',
  'secret',
  'password',
  'access_token',
  'refresh_token',
];

const BASE_OPTIONS: pino.LoggerOptions = {
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  base: { service: 'wolfkrow-worker', env: process.env['NODE_ENV'] ?? 'production' },
  timestamp: pino.stdTimeFunctions.isoTime,
};

export function createLogger(name: string): Logger {
  if (process.env['NODE_ENV'] === 'development') {
    return pino({
      ...BASE_OPTIONS,
      name,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,service,env',
        },
      },
    });
  }

  return pino({ ...BASE_OPTIONS, name });
}
