// Polling with a deadline, for adapters that read a result as it appears.
import { TimeoutError } from './errors.ts';

// Calls check() at once, then every intervalMs, until it returns a value
// other than undefined.
export async function pollUntil<T>(
  check: () => T | undefined | Promise<T | undefined>,
  { intervalMs, timeoutMs, now, sleep }: { intervalMs: number; timeoutMs: number; now: () => number; sleep: (ms: number) => Promise<void> },
): Promise<T> {
  const start = now();
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (now() - start >= timeoutMs) throw new TimeoutError(`no result after ${timeoutMs} ms`);
    await sleep(intervalMs);
  }
}
