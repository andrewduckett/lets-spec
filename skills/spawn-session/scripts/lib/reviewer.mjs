// Which model family reviews the work, and with which model. This is policy,
// so it lives here as constants, not in a skill's prose.
import { FAMILIES } from './cli.mjs';
import { NoReviewerError } from './errors.mjs';

// The t3 provider instance for each family.
export const T3_INSTANCE = { gpt: 'codex', claude: 'claudeAgent', gemini: 'antigravity' };
// The command that runs each family outside a harness.
export const HEADLESS_EXECUTOR = { gpt: 'codex', claude: 'claude', gemini: 'agy' };
// The agent kind herdr knows each family by.
export const HERDR_KIND = { gpt: 'codex', claude: 'claude', gemini: 'agy' };

// available: model ids per family, best first. An empty list means the
// family is not available; [null] means "the executor's default model".
export function pickReviewer({ author, available }) {
  for (const family of FAMILIES) {
    if (family !== author && available[family].length > 0) {
      return { family, model: available[family][0], independent: true };
    }
  }
  if (available[author].length > 0) return { family: author, model: available[author][0], independent: false };
  throw new NoReviewerError(`no reviewer family is available for an author of ${author}`);
}

// t3 lists gemini once per effort, as gemini-<version>-<effort>. Put the one
// for this effort first and keep the rest in order.
export function familiesFromT3Manifest(manifest, effort) {
  const current = manifest.manifest.currentModels;
  const families = {};
  for (const family of FAMILIES) families[family] = [...(current[T3_INSTANCE[family]] ?? [])];
  const match = families.gemini.findIndex((id) => id.endsWith(`-${effort}`));
  if (match > 0) families.gemini.unshift(...families.gemini.splice(match, 1));
  return families;
}

export function familiesFromExecutors(commandExists) {
  const families = {};
  for (const family of FAMILIES) families[family] = commandExists(HEADLESS_EXECUTOR[family]) ? [null] : [];
  return families;
}

// Each t3 provider names its effort option differently. Gemini carries the
// effort in the model id instead.
const T3_EFFORT_OPTION = { gpt: 'reasoningEffort', claude: 'effort', gemini: null };

export function t3ModelSelection({ family, model, effort }) {
  const option = T3_EFFORT_OPTION[family];
  return { instanceId: T3_INSTANCE[family], model, options: option ? [{ id: option, value: effort }] : [] };
}
