// lets delegate review run: run a prompt in a fresh, read-only session and wait
// for its final message. Checks the tree after, tells the resolver it may
// clean up, and reports which family answered. No process access here;
// everything comes through deps.
import type { Adapter } from '../resolvers/kit/adapter.ts';
import type { Deps } from '../io.ts';
import { readConfig } from './config.ts';
import { EXIT, SessionFailed, SpawnError } from '../resolvers/kit/errors.ts';
import { isTreeClean, repoRoot, treeStatus } from './git.ts';
import { guarded } from './guarded.ts';
import { checkModels, inAdapter, pick, withModels } from './lookup.ts';
import { readPromptFile } from './prompt-file.ts';
import { DEFAULT_TIMEOUT_MINUTES, normalizeName, parseModel } from '../resolvers/kit/protocol.ts';
import type { Effort, Family, Handle } from '../resolvers/kit/protocol.ts';
import type { Intent } from './strategies.ts';

// for: what the review is for, recorded in the metadata line. models: each
// <family> or <family>/<model>, best first, asked for one at a time until
// one is not refused.
export type ReviewOptions = { for: Intent; name: string; promptFile: string; sourceFamily: Family; effort: Effort; models: string[]; timeoutMinutes?: number };

// The exit code: 0 ok, 2 usage, 3 every model refused, 4 the outcome is
// unknown, 5 session failed, 6 timeout, 7 tree changed.
export function run(options: ReviewOptions, deps: Deps): Promise<number> {
  return guarded(deps, () => review(options, deps));
}

async function review({ for: intent, name, promptFile, sourceFamily, effort, models, timeoutMinutes }: ReviewOptions, deps: Deps) {
  const { io } = deps;
  const started = io.now();
  checkModels(models);
  const config = readConfig(deps);
  const prompt = readPromptFile(promptFile, deps);
  const cwd = await repoRoot(deps.cwd, io);
  // What is already uncommitted is the user's, not the session's.
  const before = await treeStatus(cwd, io);

  const adapter = await pick('run', { ...deps, config });
  const timeoutMs = (timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES[effort]) * 60000;
  const { value: { handle, text }, model: sent } = await withModels(models, (model) =>
    adapter.run({ name: normalizeName(name), prompt, cwd, ...parseModel(model)!, effort }, { timeoutMs }));
  const { family, model } = parseModel(sent)!;
  const where = `${handle.kind} ${handle.id}`;
  const finish = (ok: boolean) => finishSession(adapter, handle, { cwd, ok, deps });

  if (text.trim() === '') {
    await finish(false);
    throw new SessionFailed(`${adapter.name} gave an empty final message (${where})`);
  }

  let clean;
  try {
    clean = await isTreeClean(cwd, io, before);
  } catch (error) {
    if (!(error instanceof SpawnError)) throw error;
    await finish(false);
    deps.stderr(`lets delegate: could not check the tree after the session: ${error.message} (${where})\n`);
    return EXIT.spawn;
  }
  await finish(clean);
  if (!clean) {
    deps.stderr(`lets delegate: the session changed files outside .workspace/ (${where})\n`);
    return EXIT.dirty;
  }

  deps.stdout(text.endsWith('\n') ? text : `${text}\n`);
  const durationSeconds = Math.round((io.now() - started) / 1000);
  const independent = family !== sourceFamily;
  // The model that ran, else the --model value, when it names only a family.
  deps.stderr(`${JSON.stringify({ for: intent, resolver: adapter.name, family, model: model ?? sent, independent, handle, gitClean: true, durationSeconds })}\n`);
  return EXIT.ok;
}

// Tell the adapter that made the session that lets is done with it. ok
// false keeps the session for a person to read. A failure here does not undo
// the review, so it is reported and nothing more.
async function finishSession(adapter: Adapter, handle: Handle, { cwd, ok, deps }: { cwd: string; ok: boolean; deps: Deps }) {
  try {
    await inAdapter(() => adapter.finish(handle, ok, { cwd }));
  } catch (error) {
    deps.stderr(`lets delegate: could not finish ${handle.kind} ${handle.id}: ${(error as Error).message}\n`);
  }
}
