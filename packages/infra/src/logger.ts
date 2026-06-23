/**
 * Structured logger factory
 *
 * Uses pino for JSON/structured logging in production and pretty printing in development.
 */

import pino from 'pino';
import pretty from 'pino-pretty';

export type Logger = pino.Logger;

export function createLogger(name: string): Logger {
  const name_ = name;
  const level = process.env.LOG_LEVEL ?? 'info';

  if (process.env.NODE_ENV === 'development') {
    // pino-pretty como STREAM síncrono, não como `transport`.
    // `transport` usa worker_threads + require.resolve dinâmico do target,
    // que não resolve dentro do bundle webpack do Next.js (.next/server RSC)
    // -> "unable to determine transport target for pino-pretty". Stream direto
    // funciona em dev nativo e dentro do bundle.
    return pino(
      { name: name_, level },
      pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      })
    );
  }

  return pino({ name: name_, level });
}
