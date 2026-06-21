/** Port de logger estruturado. Infra implementa (pino); testes usam NoopLogger. */
export interface Logger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

/** Logger default p/ M0 — escreve em console. Worker substitui por pino (A.x). */
export class ConsoleLogger implements Logger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.debug(message, context ?? {});
  }
  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.info(message, context ?? {});
  }
  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.warn(message, context ?? {});
  }
  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.error(message, context ?? {});
  }
}

/** Logger que descarta tudo — útil em testes. */
export class NoopLogger implements Logger {
  debug(_message: string, _context?: Readonly<Record<string, unknown>>): void {}
  info(_message: string, _context?: Readonly<Record<string, unknown>>): void {}
  warn(_message: string, _context?: Readonly<Record<string, unknown>>): void {}
  error(_message: string, _context?: Readonly<Record<string, unknown>>): void {}
}
