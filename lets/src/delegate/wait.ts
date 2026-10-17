// Waiting with a deadline.
import type { Io } from '../io.ts';

// The promise's value, or null when ms pass first. The timer is cancelled
// either way, so it does not keep the process alive.
export async function withTimeout<T>(io: Io, promise: Promise<T>, ms: number): Promise<T | null> {
  const cancel = new AbortController();
  try {
    return await Promise.race([promise, io.sleep(ms, cancel.signal).then(() => null, () => null)]);
  } finally {
    cancel.abort();
  }
}
