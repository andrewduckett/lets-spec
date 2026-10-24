// The model families and efforts, how a model string names a family's
// model, the command that runs each family headless, and how gemini model
// names carry an effort.

export const FAMILIES = ['gpt', 'claude', 'gemini'] as const;
export const EFFORTS = ['low', 'medium', 'high'] as const;
export type Family = (typeof FAMILIES)[number];
export type Effort = (typeof EFFORTS)[number];

// A model string split into its family and id. A null model is the
// harness's default.
export type Model = { family: Family; model: string | null };

// The family and id of a model string, or null when it is not
// <family> or <family>/<id>. The id is everything after the first slash,
// and has no whitespace.
export function parseModel(text: string): Model | null {
  const slash = text.indexOf('/');
  const family = slash === -1 ? text : text.slice(0, slash);
  if (!(FAMILIES as readonly string[]).includes(family)) return null;
  if (slash === -1) return { family: family as Family, model: null };
  const model = text.slice(slash + 1);
  return model !== '' && !/\s/.test(model) ? { family: family as Family, model } : null;
}

// The command that runs each family headless.
export const HEADLESS_EXECUTOR: Record<Family, string> = { gpt: 'codex', claude: 'claude', gemini: 'agy' };

// gemini model ids carry the effort, as gemini-<version>-<effort>, because
// agy and t3 list each model once per effort.
const EFFORT_SUFFIX = /-(low|medium|high)$/;
export const withoutEffort = (model: string) => model.replace(EFFORT_SUFFIX, '');
// The model with effort added, unless it already names one.
export const withEffort = (model: string, effort: Effort) => (EFFORT_SUFFIX.test(model) ? model : `${model}-${effort}`);
