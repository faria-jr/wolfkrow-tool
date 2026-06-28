/**
 * Worker configuration
 *
 * Loads and validates environment variables with Zod.
 */

import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  HOST: z.string().default('127.0.0.1'),
  WORKER_POLL_INTERVAL_MS: z.string().transform(Number).default('60000'),
  WORKER_SECRET: z
    .string()
    .min(32)
    .default(() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('WORKER_SECRET is required in production');
      }
      return 'dev-worker-secret-must-be-32-chars-long!!';
    }),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  // Endpoint JWKS do web (corrige G2: era hardcoded http://localhost:3000/api/auth/login).
  JWKS_URL: z.string().url().default('http://localhost:3000/.well-known/jwks.json'),
  // Modo shared-workspace: quando !== 'false' (default), o worker rewrite o userId
  // efetivo para o owner, espelhando o comportamento do web.
  WOLFKROW_SHARED_WORKSPACE: z.enum(['true', 'false']).default('true'),
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse(process.env);
