import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

// Setup wizard: mínimo 8, ao menos 1 letra e 1 dígito (espelha SetupPasswordInput).
const plainPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Za-z]/, 'Must contain at least one letter')
  .regex(/\d/, 'Must contain at least one number');

// Login/unlock: aceita qualquer input não-vazio (strength já foi validado no setup).
const uncheckedSchema = z.string().min(1, 'Password is required').max(128, 'Password too long');

/** Senha em texto plano (validada em força). Hashear antes de persistir. */
export class PlainPassword extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  /** Factory para setup/cadastro — valida strength (min 8, letra + dígito). */
  static create(value: string): PlainPassword {
    const result = plainPasswordSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('password', result.error);
    return new PlainPassword(result.data);
  }

  /**
   * Factory para login/unlock — não valida strength (já aplicada no setup).
   * Apenas garante não-vazio e limite de tamanho (128 chars).
   */
  static fromUnchecked(value: string): PlainPassword {
    const result = uncheckedSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('password', result.error);
    return new PlainPassword(result.data);
  }
}
