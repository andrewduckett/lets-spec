// lets delegate review run: run a prompt in a fresh, read-only session and wait
// for its final message. Checks the tree after, tells the resolver it may
// clean up, and reports which family answered. No process access here;
// everything comes through deps.
import type { Deps } from '../io.ts';
import { readConfig } from './config.ts';
import { EXIT, exitCodeOf, SessionFailed, SpawnError } from './errors.ts';
import { isTreeClean, repoRoot, treeStatus } from './git.ts';
import { callResolver, resolveWithModels, timeoutFor } from './lookup.ts';
import type { Candidate } from './lookup.ts';
import { readPromptFile } from './prompt-file.ts';
import { buildRequest, normalizeName } from './protocol.ts';
import type { Effort, Family, Handle } from './protocol.ts';

// models: each <family> or <family>/<model>, best first, sent to the
// resolver unchanged, one at a time until one is not refused.
export type ReviewOptions = { name: string; promptFile: string; sourceFamily: Family; effort: Effort; models: string[]; timeoutMinutes?: number };

// The exit code: 0 ok, 2 usage, 3 every model refused, 4 contract or unknown outcome,
// 5 session failed, 6 timeout, 7 tree changed.
export async function run(options: ReviewOptions, deps: Deps): Promise<number> {
  try {
    return await review(options, deps);
  } catch (error) {
    const code = exitCodeOf(error);
    if (code === null) throw error;
    deps.stderr(`lets delegate: ${(error as Error).message}\n`);
    return code;
  }
}

async function review({ name, promptFile, sourceFamily, effort, models, timeoutMinutes }: ReviewOptions, deps: Deps) {
  const { io } = deps;
  const started = io.now();
  const config = readConfig(deps);
  const prompt = readPromptFile(promptFile, deps);
  const cwd = await repoRoot(deps.cwd, io);
  // What is already uncommitted is the user's, not the session's.
  const before = await treeStatus(cwd, io);

  const requestFor = (model: string) => buildRequest('run', { cwd, name: normalizeName(name), prompt, sourceFamily, effort, timeoutMinutes, model });
  const { candidate, outcome, model: sent } = await resolveWithModels('run', requestFor, models,
    { env: deps.env, io, cwd, config, packageRoot: deps.packageRoot, nodePath: deps.nodePath });
  if (outcome.code !== EXIT.ok) {
    deps.stderr(`lets delegate: ${outcome.stderr.trim()}\n`);
    return outcome.code;
  }
  const { resolver, text, family, model, handle = null } = outcome.response!;
  const where = handle ? `${handle.kind} ${handle.id}` : resolver;
  const finish = (ok: boolean) => finishSession(candidate, handle, { cwd, ok, deps });

  if (text.trim() === '') {
    await finish(false);
    throw new SessionFailed(`${resolver} gave an empty final message (${where})`);
  }

  let clean;
  try {
    clean = await isTreeClean(cwd, io, before);
  } catch (error) {
    if (!(error instanceof SpawnError)) throw error;
    await finish(false);
    deps.stderr(`lets delegate: could not check the tree after the session: ${error.message} (${where})\n`);
    return EXIT.dirty;
  }
  await finish(clean);
  if (!clean) {
    deps.stderr(`lets delegate: the session changed files outside .workspace/ (${where})\n`);
    return EXIT.dirty;
  }

  deps.stdout(text.endsWith('\n') ? text : `${text}\n`);
  const durationSeconds = Math.round((io.now() - started) / 1000);
  const independent = family !== sourceFamily;
  // The model that ran: the resolver's own name for it, else the one sent.
  deps.stderr(`${JSON.stringify({ resolver, family, model: model ?? sent, independent, handle, gitClean: true, durationSeconds })}\n`);
  return EXIT.ok;
}

// Tell the resolver that made the session that lets is done with it. ok
// false keeps the session for a person to read. A failure here does not undo
// the review, so it is reported and nothing more.
async function finishSession(candidate: Candidate, handle: Handle | null, { cwd, ok, deps }: { cwd: string; ok: boolean; deps: Deps }) {
  if (handle === null) return;
  const request = buildRequest('finish', { cwd, handle, ok });
  const outcome = await callResolver(candidate, 'finish', request, { io: deps.io, timeoutMs: timeoutFor('finish', request) });
  if (outcome === null) deps.stderr(`lets delegate: could not finish ${handle.kind} ${handle.id}: ${candidate.name} declined\n`);
  else if (outcome.code !== EXIT.ok) deps.stderr(`lets delegate: could not finish ${handle.kind} ${handle.id}: ${outcome.stderr.trim()}\n`);
}
