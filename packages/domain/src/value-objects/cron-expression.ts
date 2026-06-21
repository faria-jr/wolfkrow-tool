import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

// 5 campos: minute hour day month weekday. Validação sintática apenas —
// validação semântica (ranges/next-run) fica no infra scheduler (cron-parser).
const cronSchema = z
  .string()
  .trim()
  .regex(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/, 'Must be 5 cron fields');

/** Expressão cron de 5 campos (sintaxe). */
export class CronExpression extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): CronExpression {
    const result = cronSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('cron', result.error);
    return new CronExpression(result.data);
  }
}
