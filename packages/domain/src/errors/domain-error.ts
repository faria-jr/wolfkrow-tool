import type { ZodError } from 'zod';

/**
 * Base de todos os erros de domínio. Canonical source — shared-types/presentation
 * mapeiam para HTTP na fronteira, nunca importam estes diretamente do domínio.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly context: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Recurso não encontrado (404). */
export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} '${id}' not found`, { resource, id });
  }
}

/** Violação de invariante de negócio (422). */
export class BusinessRuleError extends DomainError {
  constructor(rule: string, message: string, context?: Record<string, unknown>) {
    super('BUSINESS_RULE', message, { rule, ...context });
  }
}

/** Conflito de estado (409) — duplicidade, versão, etc. */
export class ConflictError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFLICT', message, context);
  }
}

/** Acesso não autenticado (401). */
export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message);
  }
}

/** Acesso autenticado mas sem permissão (403). */
export class ForbiddenError extends DomainError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message);
  }
}

/** Falha de validação de value object / input (400). */
export class ValidationError extends DomainError {
  constructor(
    readonly field: string,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super('VALIDATION', message, { field, ...context });
  }

  /** Converte um ZodError em ValidationError agregando todas as issues. */
  static fromZod(field: string, error: ZodError): ValidationError {
    const issues = error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return new ValidationError(field, issues, { zodIssues: error.issues });
  }
}
