import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/review.ts';
import type { ReviewOptions } from '../../../lets/src/delegate/review.ts';
import { SessionFailed, SpawnError, TimeoutError } from '../../../lets/src/resolvers/kit/errors.ts';
import { commandDeps, CONFIG } from './fixtures/command-deps.ts';

const options = (over: Partial<ReviewOptions> = {}): ReviewOptions =>
  ({ for: 'code', name: 'X Plan Review', promptFile: 'p.md', sourceFamily: 'claude', effort: 'high', models: ['gpt/gpt-6-luna'], ...over });

// commandDeps whose config lists t3, which answers, and more as given.
const withT3 = (over: Parameters<typeof commandDeps>[0] = {}) =>
  commandDeps({ config: 'version: 3\ndelegate: { resolvers: [t3] }\n', ...over, adapters: { t3: {}, ...over.adapters } });
type Calls = ReturnType<typeof commandDeps>['adapterCalls'];
const runs = (calls: Calls) => calls('run').map(([name, , call]) => ({ name, ...(call as { input: object; options: object }) }));
const finishes = (calls: Calls) => calls('finish').map(([name, , call]) => ({ name, ...(call as { handle: object; ok: boolean; options: object }) }));
const runModels = (calls: Calls) => runs(calls).map(({ input }) => {
  const { family, model } = input as { family: string; model: string | null };
  return model === null ? family : `${family}/${model}`;
});

test('a review prints the final message, then one metadata line on stderr', async () => {
  const t = withT3();
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
  assert.deepEqual(JSON.parse(t.stderr()), {
    for: 'code', resolver: 't3', family: 'gpt', model: 'gpt-6-luna', independent: true,
    handle: { kind: 't3', id: 't3-1' }, gitClean: true, durationSeconds: 0,
  });
  assert.deepEqual(Object.keys(JSON.parse(t.stderr())), ['for', 'resolver', 'family', 'model', 'independent', 'handle', 'gitClean', 'durationSeconds']);
});

test('a code review\'s metadata line starts with for: code, and a plan review\'s with for: plan', async () => {
  for (const intent of ['code', 'plan'] as const) {
    const t = withT3();
    assert.equal(await run(options({ for: intent }), t.deps), 0);
    assert.ok(t.stderr().startsWith(`{"for":"${intent}",`), t.stderr());
  }
});

test('the adapter is asked to run the normalized name, the prompt, the family, the model and the effort', async () => {
  const t = withT3();
  await run(options(), t.deps);
  assert.deepEqual(runs(t.adapterCalls), [{
    name: 't3',
    input: { name: 'x-plan-review', prompt: 'PROMPT TEXT', cwd: '/repo', family: 'gpt', model: 'gpt-6-luna', effort: 'high' },
    options: { timeoutMs: 45 * 60000 },
  }]);
});

test('a bare family is asked for with no particular model', async () => {
  const t = withT3();
  await run(options({ models: ['claude'] }), t.deps);
  assert.deepEqual(runModels(t.adapterCalls), ['claude']);
  assert.equal(JSON.parse(t.stderr()).model, 'claude');
});

test('the timeout is the one given, else the default by effort', async () => {
  const given = withT3();
  await run(options({ timeoutMinutes: 7 }), given.deps);
  assert.deepEqual(runs(given.adapterCalls)[0].options, { timeoutMs: 7 * 60000 });
  const low = withT3();
  await run(options({ effort: 'low' }), low.deps);
  assert.deepEqual(runs(low.adapterCalls)[0].options, { timeoutMs: 15 * 60000 });
});

test('a bad --model is exit 2, naming it, and no resolver is asked', async () => {
  const t = withT3();
  assert.equal(await run(options({ models: ['gpt', 'llama/llama-4'] }), t.deps), 2);
  assert.match(t.stderr(), /llama\/llama-4/);
  assert.deepEqual(t.adapterCalls(), []);
});

test('an invalid config is exit 2, naming the file and the bad value', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate:\n  resolvers:\n    - bin/old-resolver\n' });
  assert.equal(await run(options(), t.deps), 2);
  assert.match(t.stderr(), new RegExp(`${CONFIG}.*bin/old-resolver`));
});

test('a path from an older lets is exit 2, naming the file, the path and the three names', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [/opt/r/old-resolver] }\n' });
  assert.equal(await run(options(), t.deps), 2);
  assert.equal(t.stdout(), '');
  for (const named of [CONFIG, '/opt/r/old-resolver', 't3', 'cli', 'subagent']) assert.ok(t.stderr().includes(named), named);
  assert.deepEqual(t.adapterCalls(), []);
});

test('when every listed resolver declines, a review is exit 2 with nothing on stdout', async () => {
  const t = withT3({ adapters: { t3: { declines: true } } });
  assert.equal(await run(options(), t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`every resolver declined.*${CONFIG}`));
});

test('when the first resolver declines, the next one answers', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [t3, cli] }\n', adapters: { t3: { declines: true }, cli: {} } });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(JSON.parse(t.stderr()).resolver, 'cli');
});

test('a listed resolver that answers comes before the subagent entry', async () => {
  const t = withT3({ config: 'version: 3\ndelegate: { resolvers: [t3, subagent] }\n' });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
  assert.equal(t.adapterCalls().some(([name]) => name === 'subagent'), false, 'the default was not asked');
});

test('the run request has no reviewers, whatever the config holds', async () => {
  const t = withT3({ config: 'version: 3\ndelegate: { resolvers: [t3] }\nreviewers:\n  - family: gpt\n    model: gpt-6-luna\n' });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal('reviewers' in (runs(t.adapterCalls)[0].input as object), false);
});

test('run ignores the guidance, even one that is not a string', async () => {
  const t = withT3({ config: 'version: 3\ndelegate:\n  resolvers: [t3]\n  review:\n    code:\n      guidance: 42\n' });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
});

test('finish goes to the same resolver with the handle, with ok after a clean tree', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [cli, t3] }\n', adapters: { t3: {}, cli: {} } });
  await run(options(), t.deps);
  assert.deepEqual(finishes(t.adapterCalls), [{ name: 'cli', handle: { kind: 'cli', id: 'cli-1' }, ok: true, options: { cwd: '/repo' } }]);
});

test('a family equal to the source is not independent, and still a success', async () => {
  const t = withT3();
  assert.equal(await run(options({ models: ['claude'] }), t.deps), 0);
  assert.equal(JSON.parse(t.stderr()).independent, false);
});

test('a refused model passes to the next one on the same resolver', async () => {
  const t = withT3({ adapters: { t3: { refuse: ['gpt/gpt-6-astra'] } } });
  assert.equal(await run(options({ models: ['gpt/gpt-6-astra', 'gemini/gemini-3-pro'] }), t.deps), 0);
  assert.deepEqual(runModels(t.adapterCalls), ['gpt/gpt-6-astra', 'gemini/gemini-3-pro']);
  assert.equal(t.stdout(), 'FINDINGS\n');
  assert.equal(JSON.parse(t.stderr()).model, 'gemini-3-pro');
});

test('a review whose every model is refused is exit 3, naming each model', async () => {
  const t = withT3({ adapters: { t3: { refuse: ['gpt/gpt-6-astra', 'gemini'] } } });
  assert.equal(await run(options({ models: ['gpt/gpt-6-astra', 'gemini'] }), t.deps), 3);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /gpt\/gpt-6-astra: refused gpt\/gpt-6-astra\ngemini: refused gemini/);
});

test('a refusal never moves down the chain', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [t3, cli] }\n', adapters: { t3: { refuse: ['gpt', 'gemini'] }, cli: {} } });
  assert.equal(await run(options({ models: ['gpt', 'gemini'] }), t.deps), 3);
  assert.equal(t.adapterCalls().some(([name]) => name === 'cli'), false, 'cli was not asked');
});

test('a failed session is exit 5, and the next model is not asked', async () => {
  const t = withT3({ adapters: { t3: { run: new SessionFailed('the session stopped to ask') } } });
  assert.equal(await run(options({ models: ['gpt', 'gemini'] }), t.deps), 5);
  assert.match(t.stderr(), /stopped to ask/);
  assert.deepEqual(runModels(t.adapterCalls), ['gpt']);
});

test('a session past its time is exit 6, and a known outcome-unknown error exit 4', async () => {
  for (const [error, code] of [[new TimeoutError('no result in 45 minutes'), 6], [new SpawnError('T3 did not answer'), 4]] as const) {
    const t = withT3({ adapters: { t3: { run: error } } });
    assert.equal(await run(options(), t.deps), code, error.message);
    assert.match(t.stderr(), new RegExp(error.message));
    assert.equal(t.stdout(), '');
  }
});

test('an unexpected failure inside the resolver is exit 4 with its message', async () => {
  const t = withT3({ adapters: { t3: { run: new Error('boom') } } });
  assert.equal(await run(options(), t.deps), 4);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /boom/);
});

test('an empty final message is exit 5, with finish ok false', async () => {
  const t = withT3({ adapters: { t3: { run: { text: ' \n' } } } });
  assert.equal(await run(options(), t.deps), 5);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /empty final message \(t3 t3-1\)/);
  assert.deepEqual(finishes(t.adapterCalls).map(({ ok }) => ok), [false]);
});

test('a tree the session changed is exit 7, with finish ok false and no findings', async () => {
  const t = withT3({ gitBefore: '', gitAfter: ' M src/a.js\0' });
  assert.equal(await run(options(), t.deps), 7);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /changed files outside \.workspace\/ \(t3 t3-1\)/);
  assert.deepEqual(finishes(t.adapterCalls).map(({ ok }) => ok), [false]);
});

test('a git status that fails after the session is exit 4, with finish ok false', async () => {
  const t = withT3({ gitAfterFails: true });
  assert.equal(await run(options(), t.deps), 4);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /could not check the tree after the session: git status failed in \/repo: index.lock exists \(t3 t3-1\)/);
  assert.deepEqual(finishes(t.adapterCalls).map(({ ok }) => ok), [false]);
});

test('files the user had already changed, and scratch files, do not count', async () => {
  const t = withT3({ gitBefore: ' M src/a.js\0?? .envrc\0', gitAfter: ' M src/a.js\0?? .envrc\0?? .workspace/x\0' });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
});

test('a finish that fails is reported, and the review still succeeds', async () => {
  for (const error of [new SpawnError('thread gone'), new Error('thread gone')]) {
    const t = withT3({ adapters: { t3: { finish: error } } });
    assert.equal(await run(options(), t.deps), 0);
    assert.equal(t.stdout(), 'FINDINGS\n');
    const lines = t.stderr().trim().split('\n');
    assert.match(lines[0], /could not finish t3 t3-1: thread gone/);
    assert.equal(JSON.parse(lines[1]).gitClean, true);
  }
});

test('a prompt file that cannot be read is exit 2, naming it, and no resolver is asked', async () => {
  const t = withT3({ files: {} });
  assert.equal(await run(options(), t.deps), 2);
  assert.match(t.stderr(), /p\.md/);
  assert.deepEqual(t.adapterCalls(), []);
});

test('with no config, the review is exit 3, prints nothing, and asks only the default', async () => {
  const t = commandDeps();
  assert.equal(await run(options(), t.deps), 3);
  assert.equal(t.stdout(), '');
  assert.deepEqual([...new Set(t.adapterCalls().map(([name]) => name))], ['subagent']);
  assert.match(t.stderr(), /no resolver started a session/);
  assert.match(t.stderr(), /subagent/);
  assert.doesNotMatch(t.stderr(), /installed/);
});

test('a review runs no program but git, whatever the environment holds', async () => {
  const t = withT3();
  t.deps.env = { ...process.env };
  assert.equal(await run(options(), t.deps), 0);
  assert.deepEqual([...new Set(t.io.calls.map(([cmd]) => cmd))], ['git']);
});
