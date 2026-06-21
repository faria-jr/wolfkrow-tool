/**
 * Domain error classes — typed errors thrown across the app
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  public readonly metadata: Record<string, unknown>;

  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? `: ${id}` : ''}`, { resource, id });
  }
}

/**
 * 400 Validation
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
}

/**
 * 409 Conflict
 */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

/**
 * 429 Rate Limit
 */
export class RateLimitError extends DomainError {
  readonly code = 'RATE_LIMIT';
  readonly statusCode = 429;

  constructor(retryAfterMs: number) {
    super('Rate limit exceeded', { retryAfterMs });
  }
}

/**
 * 502 External Service
 */
export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(service: string, message: string) {
    super(`${service}: ${message}`, { service });
  }
}

/**
 * 500 Config
 */
export class ConfigError extends DomainError {
  readonly code = 'CONFIG_ERROR';
  readonly statusCode = 500;
}

/**
 * 500 Infrastructure
 */
export class InfrastructureError extends DomainError {
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly statusCode = 500;
}

/**
 * 500 Application
 */
export class ApplicationError extends DomainError {
  readonly code = 'APPLICATION_ERROR';
  readonly statusCode = 500;
}

/**
 * Domain-specific Not Found errors
 */
export class AgentNotFoundError extends NotFoundError {
  constructor(agentId: string) {
    super('Agent', agentId);
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super('ChatSession', sessionId);
  }
}

export class MessageNotFoundError extends NotFoundError {
  constructor(messageId: string) {
    super('ChatMessage', messageId);
  }
}

export class DocumentNotFoundError extends NotFoundError {
  constructor(documentId: string) {
    super('KnowledgeDocument', documentId);
  }
}

export class SecretNotFoundError extends NotFoundError {
  constructor(key: string) {
    super('Secret', key);
  }
}

export class MCPServerNotFoundError extends NotFoundError {
  constructor(name: string) {
    super('MCPServer', name);
  }
}

/**
 * Domain-specific runtime errors
 */
export class MCPNotRunningError extends DomainError {
  readonly code = 'MCP_NOT_RUNNING';
  readonly statusCode = 503;

  constructor(name: string) {
    super(`MCP ${name} is not running`, { mcpName: name });
  }
}

export class MCPTimeoutError extends DomainError {
  readonly code = 'MCP_TIMEOUT';
  readonly statusCode = 504;

  constructor(name: string, method: string) {
    super(`MCP ${name} method ${method} timed out`, { mcpName: name, method });
  }
}

export class AccountLockedError extends DomainError {
  readonly code = 'ACCOUNT_LOCKED';
  readonly statusCode = 423;

  constructor(lockedUntil: Date) {
    super('Account is locked', { lockedUntil });
  }
}

export class TOTPRequiredError extends DomainError {
  readonly code = 'TOTP_REQUIRED';
  readonly statusCode = 401;

  constructor(message = 'TOTP_REQUIRED') {
    super(message);
  }
}

export class PermissionDeniedError extends DomainError {
  readonly code = 'PERMISSION_DENIED';
  readonly statusCode = 403;

  constructor(tool: string, reason: string) {
    super(`Tool ${tool} denied: ${reason}`, { tool, reason });
  }
}

/**
 * Serialization helper — converts any error to a JSON-friendly shape
 */
export function serializeError(error: unknown): {
  name: string;
  code: string;
  statusCode: number;
  message: string;
  metadata: Record<string, unknown>;
} {
  if (error instanceof DomainError) {
    return {
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      metadata: error.metadata,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      message: error.message,
      metadata: {},
    };
  }
  return {
    name: 'UnknownError',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    message: String(error),
    metadata: {},
  };
}
