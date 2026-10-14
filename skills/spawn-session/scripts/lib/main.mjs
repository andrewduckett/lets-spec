// The whole flow: parse, choose the harness, spawn, wait, check, report.
// No process access here; everything comes through deps, so tests run it
// with fakes.
import { resolve } from 'node:path';
import { parseArgs, USAGE } from './cli.mjs';
import { EXIT, NoReviewerError, ReviewerFailed, SpawnError, TimeoutError, UsageError } from './errors.mjs';
import { chooseAdapter } from './harness.mjs';
import { codeReviewMessage } from './messages.mjs';
import { pickReviewer } from './reviewer.mjs';
import { isTreeClean, treeStatus } from './git.mjs';

// deps: { env, cwd, adapters: { t3, herdr, none }, stdout(text), stderr(text),
//         readFile(path), execFile, now, sleep }
export async function run(argv, deps) {
  let parsed, adapter;
  try {
    parsed = parseArgs(argv);
    if (parsed.command === 'help') {
      deps.stdout(USAGE);
      return EXIT.ok;
    }
    adapter = chooseAdapter({ env: deps.env, adapters: deps.adapters });
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.stderr(`spawn-session: ${error.message}\n${USAGE}`);
    return EXIT.usage;
  }

  if (parsed.command === 'detect') {
    deps.stdout(`${adapter.name}\n`);
    return EXIT.ok;
  }
  if (parsed.command === 'handoff') return handoff(parsed, adapter, deps);
  return critique(parsed, adapter, deps);
}

async function handoff({ name, prompt, unattended, model }, adapter, deps) {
  let handle;
  try {
    handle = await adapter.spawn({ kind: 'handoff', name, prompt, cwd: deps.cwd, family: 'claude', model, effort: null, attended: !unattended, readOnly: false });
  } catch (error) {
    if (!(error instanceof SpawnError)) throw error;
    deps.stderr(`spawn-session: ${error.message}\n`);
    return EXIT.spawn;
  }
  deps.stdout(`${JSON.stringify({ harness: adapter.name, threadId: handle.id })}\n`);
  return EXIT.ok;
}

async function critique({ name, author, effort, promptFile, codeReview, timeoutMinutes }, adapter, deps) {
  const started = deps.now();
  let fileText = null;
  if (promptFile !== null) {
    try {
      fileText = deps.readFile(resolve(deps.cwd, promptFile));
    } catch (error) {
      deps.stderr(`spawn-session: cannot read --prompt-file ${promptFile}: ${error.message}\n${USAGE}`);
      return EXIT.usage;
    }
  }

  let reviewer;
  try {
    reviewer = pickReviewer({ author, available: adapter.availableFamilies({ effort }) });
  } catch (error) {
    if (!(error instanceof NoReviewerError)) throw error;
    deps.stderr(`spawn-session: no reviewer family is available for an author of ${author}\n`);
    return EXIT.noReviewer;
  }
  const { family, model, independent } = reviewer;
  const prompt = fileText ?? codeReviewMessage({ family, base: codeReview.base, effort, harness: adapter.name });

  // What is already uncommitted is the user's, not the reviewer's.
  let before, handle;
  try {
    before = await treeStatus(deps.cwd, { execFile: deps.execFile });
    handle = await adapter.spawn({ kind: 'critique', name, prompt, cwd: deps.cwd, family, model, effort, attended: false, readOnly: true, codeReview, timeoutMinutes });
  } catch (error) {
    if (!(error instanceof SpawnError)) throw error;
    deps.stderr(`spawn-session: ${error.message}\n`);
    return EXIT.spawn;
  }

  let text;
  try {
    ({ text } = await adapter.waitForResult(handle, { timeoutMs: timeoutMinutes * 60000 }));
    if (text.trim() === '') throw new ReviewerFailed('empty final message');
  } catch (error) {
    if (error instanceof ReviewerFailed) {
      await adapter.finish(handle, false);
      deps.stderr(`spawn-session: reviewer failed: ${error.message} (thread ${handle.id})\n`);
      return EXIT.reviewer;
    }
    if (error instanceof TimeoutError) {
      await adapter.finish(handle, false);
      deps.stderr(`spawn-session: timed out after ${timeoutMinutes} minutes waiting on thread ${handle.id}\n`);
      return EXIT.timeout;
    }
    throw error;
  }

  let clean;
  try {
    clean = await isTreeClean(deps.cwd, { execFile: deps.execFile, before });
  } catch (error) {
    if (!(error instanceof SpawnError)) throw error;
    await adapter.finish(handle, false);
    deps.stderr(`spawn-session: could not check the tree after the review: ${error.message} (thread ${handle.id})\n`);
    return EXIT.dirty;
  }
  if (!clean) {
    await adapter.finish(handle, false);
    deps.stderr(`spawn-session: the reviewer changed files outside .workspace/ (thread ${handle.id})\n`);
    return EXIT.dirty;
  }

  await adapter.finish(handle, true);
  deps.stdout(text.endsWith('\n') ? text : `${text}\n`);
  const durationSeconds = Math.round((deps.now() - started) / 1000);
  deps.stderr(`${JSON.stringify({ harness: adapter.name, family, model, independent, threadId: handle.id, gitClean: true, durationSeconds })}\n`);
  return EXIT.ok;
}
