import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — Combina clsx + tailwind-merge
 *
 * - clsx: conditional classes (e.g., cn('p-4', isActive && 'bg-blue-500'))
 * - tailwind-merge: resolve conflicts (e.g., 'p-2 p-4' → 'p-4')
 *
 * Use em TODOS os componentes shadcn/ui e custom components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * formatCurrency — Formata valor como USD
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

/**
 * formatNumber — Formata número com separadores
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * formatRelativeTime — Formata data como "2 hours ago"
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffInSeconds = Math.floor((now - then) / 1000);

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (diffInSeconds < 60) return formatter.format(-diffInSeconds, 'second');
  if (diffInSeconds < 3600) return formatter.format(-Math.floor(diffInSeconds / 60), 'minute');
  if (diffInSeconds < 86400) return formatter.format(-Math.floor(diffInSeconds / 3600), 'hour');
  if (diffInSeconds < 2592000) return formatter.format(-Math.floor(diffInSeconds / 86400), 'day');
  if (diffInSeconds < 31536000) return formatter.format(-Math.floor(diffInSeconds / 2592000), 'month');
  return formatter.format(-Math.floor(diffInSeconds / 31536000), 'year');
}

/**
 * formatDuration — Formata milissegundos como "2h 15m 30s"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * truncate — Trunca string com ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * sleep — Promise que resolve após N ms
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * generateId — Gera UUID v4
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * debounce — Debounce function
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), waitMs);
  };
}

/**
 * assertNever — TypeScript exhaustiveness check
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
