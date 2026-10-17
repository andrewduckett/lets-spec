// Copied from lets/src/delegate/families.ts, so this resolver installs on its own.
// Keep the two the same: a test compares them, and the conformance check runs
// against this resolver in CI.

// Which family takes a session. The order is the default's policy: the
// first family in FAMILIES that is available, skipping the source; the
// source's own family when no other is.
import { NoFamilyError } from './errors.ts';
import { FAMILIES } from './protocol.ts';
import type { Family } from './protocol.ts';

// The command that runs each family headless.
export const HEADLESS_EXECUTOR: Record<Family, string> = { gpt: 'codex', claude: 'claude', gemini: 'agy' };

// Model ids per family, best first. An empty list means the family is not
// available; [null] means "the executor's default model".
export type Available = Record<Family, (string | null)[]>;

export function pickFamily({ sourceFamily, available }: { sourceFamily: Family; available: Available }) {
  for (const family of FAMILIES) {
    if (family !== sourceFamily && available[family].length > 0) return { family, model: available[family][0] };
  }
  if (available[sourceFamily].length > 0) return { family: sourceFamily, model: available[sourceFamily][0] };
  throw new NoFamilyError(`no family is available for a source of ${sourceFamily}`);
}

// Each family whose executor is on PATH, with its default model.
export function familiesFromExecutors(commandExists: (cmd: string) => boolean): Available {
  const available = {} as Available;
  for (const family of FAMILIES) available[family] = commandExists(HEADLESS_EXECUTOR[family]) ? [null] : [];
  return available;
}
