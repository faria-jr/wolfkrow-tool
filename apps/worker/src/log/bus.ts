/**
 * In-memory log bus — ring buffer (last 500 entries) + pub/sub for SSE tail.
 */

const RING_SIZE = 500;

export interface LogEntry {
  level: string;
  time: number;
  msg: string;
  module?: string;
  reqId?: string;
  [key: string]: unknown;
}

type Subscriber = (entry: LogEntry) => void;

class LogBus {
  private ring: LogEntry[] = [];
  private subscribers = new Set<Subscriber>();

  publish(entry: LogEntry): void {
    if (this.ring.length >= RING_SIZE) this.ring.shift();
    this.ring.push(entry);
    for (const sub of this.subscribers) {
      try {
        sub(entry);
      } catch {
        /* ignore */
      }
    }
  }

  subscribe(sub: Subscriber): () => void {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  history(limit = 100): LogEntry[] {
    return this.ring.slice(-limit);
  }
}

export const logBus = new LogBus();
