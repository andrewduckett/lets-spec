import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/instructions.ts';
import { commandDeps, CONFIG } from './fixtures/command-deps.ts';
import type { FakeResolver } from './fixtures/command-deps.ts';

const review = { strategy: 'review', for: 'code' } as const;
const handoff = { strategy: 'handoff', for: 'apply' } as const;
// commandDeps whose config lists t3, behaving as given, with more under it.
const withT3 = (more = '', t3: FakeResolver = {}) =>
  commandDeps({ config: `version: 2\nresolvers: [t3]\n${more}`, adapters: { t3 } });

test('instructions prints the strategy, the intent, the resolver and its options as one JSON line', async () => {
  const t = withT3('', { options: ['gpt/gpt-6-luna', 'claude'] });
  assert.equal(await run(review, t.deps), 0);
  assert.equal(t.stdout().split('\n').length, 2);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'review', for: 'code', resolver: 't3', options: ['gpt/gpt-6-luna', 'claude'], guidance: null });
});

test('with no config, the default answers with no options', async () => {
  const t = commandDeps();
  assert.equal(await run(handoff, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'handoff', for: 'apply', resolver: 'subagent', options: [], guidance: null });
});

test('with no config, outside any harness, a review answers as the default with no options', async () => {
  const t = commandDeps();
  assert.equal(await run(review, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'review', for: 'code', resolver: 'subagent', options: [], guidance: null });
});

test('instructions starts, runs and finishes nothing', async () => {
  for (const options of [review, handoff, { strategy: 'review', for: 'plan' } as const]) {
    const t = withT3();
    await run(options, t.deps);
    assert.deepEqual(t.adapterCalls().map(([, method]) => method), ['detect', 'options'], options.for);
  }
});

test('a review asks for a resolver that can run, and a handoff for one that can start', async () => {
  const deps = () => commandDeps({ config: 'version: 2\nresolvers: [cli, subagent]\n', adapters: { cli: { headless: true } } });
  const t = deps();
  await run(review, t.deps);
  assert.equal(JSON.parse(t.stdout()).resolver, 'cli');
  const h = deps();
  await run(handoff, h.deps);
  assert.deepEqual(JSON.parse(h.stdout()), { strategy: 'handoff', for: 'apply', resolver: 'subagent', options: [], guidance: null });
});

test('a resolver that declines passes it down the chain', async () => {
  const t = commandDeps({ config: 'version: 2\nresolvers: [t3, subagent]\n', adapters: { t3: { declines: true } } });
  assert.equal(await run(handoff, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
});

test('each warning of the resolver is a line on stderr', async () => {
  const t = withT3('', { warnings: ['the manifest is old', 'claude is slow'] });
  assert.equal(await run(review, t.deps), 0);
  assert.equal(t.stderr(), 'lets delegate: the manifest is old\nlets delegate: claude is slow\n');
});

test('the guidance for the intent comes from the config', async () => {
  const t = withT3('delegations:\n  code:\n    guidance: Use the strongest gpt model.\n');
  assert.equal(await run(review, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).guidance, 'Use the strongest gpt model.');
});

test('guidance for another intent only is null', async () => {
  const t = withT3('delegations:\n  code:\n    guidance: Use gpt.\n');
  await run({ strategy: 'review', for: 'plan' }, t.deps);
  assert.equal(JSON.parse(t.stdout()).guidance, null);
});

test('a multi-line block keeps its lines', async () => {
  const t = withT3('delegations:\n  apply:\n    guidance: |\n      Prefer claude.\n      Never gemini.\n');
  await run(handoff, t.deps);
  assert.equal(JSON.parse(t.stdout()).guidance, 'Prefer claude.\nNever gemini.\n');
});

test('malformed guidance is exit 2, naming the file and the key, and asks no resolver', async () => {
  const t = withT3('delegations:\n  code:\n    guidance: 42\n');
  assert.equal(await run(review, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`${CONFIG}.*delegations\\.code\\.guidance`));
  assert.deepEqual(t.adapterCalls(), []);
});

test('a bad entry for another intent is not checked', async () => {
  const t = withT3('delegations:\n  plan:\n    guidance: [a, b]\n');
  assert.equal(await run(review, t.deps), 0);
});

test('a chain where every resolver declines is exit 2, naming the config file', async () => {
  const t = withT3('', { declines: true });
  assert.equal(await run(review, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`every resolver declined.*${CONFIG}`));
});

test('a path from an older lets is exit 2, naming it and the config file', async () => {
  const t = commandDeps({ config: 'version: 2\nresolvers: [/gone/old-resolver]\n' });
  assert.equal(await run(review, t.deps), 2);
  assert.match(t.stderr(), new RegExp(`${CONFIG}.*/gone/old-resolver`));
  assert.deepEqual(t.adapterCalls(), []);
});

test('a resolver whose options fail unexpectedly is exit 4 with the message', async () => {
  const t = withT3();
  t.deps.resolvers.t3.options = async () => {
    throw new Error('manifest unreadable');
  };
  assert.equal(await run(review, t.deps), 4);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /manifest unreadable/);
});
