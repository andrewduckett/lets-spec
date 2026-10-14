// Polling with a deadline, for adapters that read a result as it appears.
import { TimeoutError } from './errors.mjs';

// Calls check() at once, then every intervalMs, until it returns a value
// other than undefined.
export async function pollUntil(check, { intervalMs, timeoutMs, now, sleep }) {
  const start = now();
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (now() - start >= timeoutMs) throw new TimeoutError(`no result after ${timeoutMs} ms`);
    await sleep(intervalMs);
  }
}
