// Which harness the new session lands in. LETS_SPEC_HARNESS wins; otherwise
// the first adapter that finds this process inside its harness.
import { UsageError } from './errors.mjs';

export const HARNESSES = ['t3', 'herdr', 'none'];

export function chooseAdapter({ env, adapters }) {
  const override = env.LETS_SPEC_HARNESS;
  if (override !== undefined && override !== '') {
    if (!HARNESSES.includes(override)) throw new UsageError(`LETS_SPEC_HARNESS must be one of ${HARNESSES.join(', ')}: ${override}`);
    return adapters[override];
  }
  for (const name of ['t3', 'herdr']) {
    if (adapters[name].detect(env)) return adapters[name];
  }
  return adapters.none;
}
