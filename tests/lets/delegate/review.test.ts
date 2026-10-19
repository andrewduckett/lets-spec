import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/review.ts';
import type { ReviewOptions } from '../../../lets/src/delegate/review.ts';
import { commandDeps } from './fixtures/command-deps.ts';

const options = (over: Partial<ReviewOptions> = {}): ReviewOptions =>
  ({ name: 'X Plan Review', promptFile: 'p.md', sourceFamily: 'claude', effort: 'high', ...over });

const finishes = (calls: [string, Record<string, unknown>][]) => calls.filter(([verb]) => verb === 'finish').map(([, request]) => request);

test('a review prints the final message, then one metadata line on stderr', async () => {
  const t = commandDeps();
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
  assert.deepEqual(JSON.parse(t.stderr()), {
    resolver: 'fake', family: 'gpt', model: 'fake-model', independent: true,
    handle: { kind: 'fake', id: 'f-1', extra: 'kept' }, gitClean: true, durationSeconds: 0,
  });
});

test('the run request carries the need, with readOnly true and interactive false', async () => {
  const t = commandDeps();
  await run(options(), t.deps);
  const [[verb, request]] = t.resolverCalls();
  assert.equal(verb, 'run');
  assert.deepEqual(request, {
    protocol: 1, cwd: '/repo', name: 'x-plan-review', prompt: 'PROMPT TEXT', sourceFamily: 'claude',
    readOnly: true, interactive: false, effort: 'high', timeoutMinutes: 45,
  });
});

test('the timeout is the one given, else the default by effort', async () => {
  const given = commandDeps();
  await run(options({ timeoutMinutes: 7 }), given.deps);
  assert.equal(given.resolverCalls()[0][1].timeoutMinutes, 7);
  const low = commandDeps();
  await run(options({ effort: 'low' }), low.deps);
  assert.equal(low.resolverCalls()[0][1].timeoutMinutes, 15);
});

test('finish gets the handle whole, with ok true after a clean tree', async () => {
  const t = commandDeps();
  await run(options(), t.deps);
  assert.deepEqual(finishes(t.resolverCalls()), [{ protocol: 1, cwd: '/repo', handle: { kind: 'fake', id: 'f-1', extra: 'kept' }, ok: true }]);
});

test('a family equal to the source is not independent, and still a success', async () => {
  const t = commandDeps({ settings: { FAKE_RESOLVER_FAMILY: 'claude' } });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(JSON.parse(t.stderr()).independent, false);
});

test('a family missing or unknown is exit 4, and finish is not sent', async () => {
  for (const stdout of ['{"resolver":"fake","text":"T"}', '{"resolver":"fake","text":"T","family":"openai","handle":{"kind":"k","id":"1"}}']) {
    const t = commandDeps({ settings: { FAKE_RESOLVER_STDOUT_RUN: stdout } });
    assert.equal(await run(options(), t.deps), 4);
    assert.match(t.stderr(), /broke the contract.*family/);
    assert.equal(t.stdout(), '');
    assert.deepEqual(finishes(t.resolverCalls()), []);
  }
});

test('a resolver\'s exit 3, 5 and 6 pass through; a usage error or any other code is 4', async () => {
  for (const [resolverExit, letsExit] of [['3', 3], ['5', 5], ['6', 6], ['2', 4], ['1', 4]] as const) {
    const t = commandDeps({ settings: { FAKE_RESOLVER_EXIT_RUN: resolverExit, FAKE_RESOLVER_STDOUT_RUN: '', FAKE_RESOLVER_STDERR: 'why' } });
    assert.equal(await run(options(), t.deps), letsExit, `resolver exit ${resolverExit}`);
    assert.match(t.stderr(), /why/);
    assert.equal(t.stdout(), '');
  }
});

test('a tree the session changed is exit 7, with finish ok false and no findings', async () => {
  const t = commandDeps({ gitBefore: '', gitAfter: ' M src/a.js\0' });
  assert.equal(await run(options(), t.deps), 7);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /changed files outside \.workspace\/ \(fake f-1\)/);
  assert.deepEqual(finishes(t.resolverCalls()).map(({ ok }) => ok), [false]);
});

test('files the user had already changed, and scratch files, do not count', async () => {
  const t = commandDeps({ gitBefore: ' M src/a.js\0?? .envrc\0', gitAfter: ' M src/a.js\0?? .envrc\0?? .workspace/x\0' });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
});

test('a finish that fails is reported, and the review still succeeds', async () => {
  const t = commandDeps({ settings: { FAKE_RESOLVER_EXIT_FINISH: '4', FAKE_RESOLVER_STDOUT_FINISH: '', FAKE_RESOLVER_STDERR_FINISH: 'thread gone' } });
  assert.equal(await run(options(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
  const lines = t.stderr().trim().split('\n');
  assert.match(lines[0], /could not finish fake f-1: thread gone/);
  assert.equal(JSON.parse(lines[1]).gitClean, true);
});

test('no handle means no finish', async () => {
  const t = commandDeps({ settings: { FAKE_RESOLVER_STDOUT_RUN: '{"resolver":"fake","text":"T","family":"gpt","handle":null}' } });
  assert.equal(await run(options(), t.deps), 0);
  assert.deepEqual(finishes(t.resolverCalls()), []);
  assert.deepEqual(JSON.parse(t.stderr()),
    { resolver: 'fake', family: 'gpt', model: null, independent: true, handle: null, gitClean: true, durationSeconds: 0 });
});

test('an empty final message is exit 5, with finish ok false', async () => {
  const t = commandDeps({ settings: { FAKE_RESOLVER_STDOUT_RUN: '{"resolver":"fake","text":" \\n","family":"gpt","handle":{"kind":"k","id":"1"}}' } });
  assert.equal(await run(options(), t.deps), 5);
  assert.match(t.stderr(), /empty final message/);
  assert.deepEqual(finishes(t.resolverCalls()).map(({ ok }) => ok), [false]);
});

test('a prompt file that cannot be read is exit 2, naming it, and no resolver is asked', async () => {
  const t = commandDeps({ files: {} });
  assert.equal(await run(options(), t.deps), 2);
  assert.match(t.stderr(), /p\.md/);
  assert.deepEqual(t.resolverCalls(), []);
});

test('LETS_SPEC_RESOLVER naming a missing file is exit 2, naming it', async () => {
  const t = commandDeps();
  t.deps.env.LETS_SPEC_RESOLVER = '/no/such/resolver';
  assert.equal(await run(options(), t.deps), 2);
  assert.match(t.stderr(), /\/no\/such\/resolver/);
});

test('with no resolver, the review is exit 3, prints nothing, and starts no process', async () => {
  const t = commandDeps({ resolver: false, commands: ['codex', 'claude', 'agy'] });
  assert.equal(await run(options(), t.deps), 3);
  assert.equal(t.stdout(), '');
  assert.deepEqual(t.io.calls.filter(([cmd]) => cmd !== 'git'), []);
});
