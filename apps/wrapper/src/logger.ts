const level = process.env['LOG_LEVEL'] ?? 'info';
const isDev = process.env['NODE_ENV'] === 'development';

function log(lvl: 'warn' | 'error' | 'info', name: string, msg: string, extra?: unknown): void {
  const entry = {
    time: new Date().toISOString(),
    level: lvl,
    service: 'wolfkrow-wrapper',
    name,
    msg,
    ...(extra !== undefined ? { extra } : {}),
  };
  const line = isDev
    ? `[${lvl.toUpperCase()}] [${name}] ${msg}${extra !== undefined ? ` ${JSON.stringify(extra)}` : ''}`
    : JSON.stringify(entry);
  if (lvl === 'error') process.stderr.write(line + '\n');
  else if (lvl === 'warn' || level !== 'error') process.stdout.write(line + '\n');
}

export function createLogger(name: string) {
  return {
    info: (msg: string, extra?: unknown) => log('info', name, msg, extra),
    warn: (msg: string, extra?: unknown) => log('warn', name, msg, extra),
    error: (msg: string, extra?: unknown) => log('error', name, msg, extra),
  };
}
