// The kit's own. It began as a copy of lets/src/delegate/families.ts,
// which lets no longer needs, so the two may differ.

import type { Effort, Family } from './protocol.ts';

// The command that runs each family headless.
export const HEADLESS_EXECUTOR: Record<Family, string> = { gpt: 'codex', claude: 'claude', gemini: 'agy' };

// gemini model ids carry the effort, as gemini-<version>-<effort>, because
// agy and t3 list each model once per effort.
const EFFORT_SUFFIX = /-(low|medium|high)$/;
export const withoutEffort = (model: string) => model.replace(EFFORT_SUFFIX, '');
// The model with effort added, unless it already names one.
export const withEffort = (model: string, effort: Effort) => (EFFORT_SUFFIX.test(model) ? model : `${model}-${effort}`);
