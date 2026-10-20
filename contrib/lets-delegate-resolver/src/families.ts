// This resolver's own. It began as a copy of lets/src/delegate/families.ts,
// which lets no longer needs, so the two may differ.

// Which family takes a session. With the reviewers lets sends, the first
// one from another family that is available, else the first that is. Without
// them, this resolver's policy: the first family in FAMILIES that is
// available, skipping the source; the source's own family when no other is.
import { NoFamilyError } from './errors.ts';
import { FAMILIES } from './protocol.ts';
import type { Family, Reviewer } from './protocol.ts';

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

// The reviewer to run. A reviewer can run when its family is available; its
// model need not be in that list, because the account's own list, which
// lets wrote into the config, is the authority. whyNot says why a family is
// not available, for the error when no reviewer can run.
export function pickReviewer({ sourceFamily, reviewers, available, whyNot }: {
  sourceFamily: Family; reviewers: Reviewer[]; available: Available; whyNot: (family: Family) => string;
}): Reviewer {
  const runnable = reviewers.filter(({ family }) => available[family].length > 0);
  const chosen = runnable.find(({ family }) => family !== sourceFamily) ?? runnable[0];
  if (chosen !== undefined) return chosen;
  if (reviewers.length === 0) throw new NoFamilyError('the request has no reviewers for this effort');
  const skipped = reviewers.map(({ family, model }) => `  ${family}/${model ?? 'default'}: ${whyNot(family)}`);
  throw new NoFamilyError(`no reviewer can run here:\n${skipped.join('\n')}`);
}

// Each family whose executor is on PATH, with its default model.
export function familiesFromExecutors(commandExists: (cmd: string) => boolean): Available {
  const available = {} as Available;
  for (const family of FAMILIES) available[family] = commandExists(HEADLESS_EXECUTOR[family]) ? [null] : [];
  return available;
}
