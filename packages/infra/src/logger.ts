/**
 * Structured logger factory
 *
 * Uses pino for JSON/structured logging in production and pretty printing in development.
 */

import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(name: string): Logger {
  const baseOptions = {
    name,
    level: process.env.LOG_LEVEL ?? 'info',
  };

  if (process.env.NODE_ENV === 'development') {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(baseOptions);
}
