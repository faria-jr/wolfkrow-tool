const windows = new Map<string, number[]>();

export function checkRateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const prev = (windows.get(key) ?? []).filter((t) => t > now - windowMs);
  if (prev.length >= limit) return false;
  prev.push(now);
  windows.set(key, prev);
  return true;
}

export function clearRateLimitStore(): void {
  windows.clear();
}
