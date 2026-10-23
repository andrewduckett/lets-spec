import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/instructions.ts';
import { commandDeps, CONFIG, FAKE_RESOLVER } from './fixtures/command-deps.ts';

const review = { strategy: 'review', for: 'code' } as const;
const handoff = { strategy: 'handoff', for: 'apply' } as const;
// commandDeps with no override, and a config that lists the fake resolver
// with more under it.
const listingFake = (more = '', settings: Record<string, string> = {}) =>
  commandDeps({ resolver: false, config: `version: 2\nresolvers: [${FAKE_RESOLVER}]\n${more}`, settings });
const probes = (calls: [string, Record<string, unknown>][]) => calls.filter(([verb]) => verb === 'probe').map(([, request]) => request);

test('instructions prints the strategy, the intent, the resolver and its options as one JSON line', async () => {
  const t = listingFake('', { FAKE_RESOLVER_STDOUT_PROBE: '{"resolver":"t3","options":["gpt/gpt-6-luna","claude"]}' });
  assert.equal(await run(review, t.deps), 0);
  assert.equal(t.stdout().split('\n').length, 2);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'review', for: 'code', resolver: 't3', options: ['gpt/gpt-6-luna', 'claude'], guidance: null });
});

test('with no config, the default answers with no options', async () => {
  const t = commandDeps({ resolver: false });
  assert.equal(await run(handoff, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'handoff', for: 'apply', resolver: 'subagent', options: [], guidance: null });
});

test('instructions sends only a probe', async () => {
  const t = commandDeps();
  await run({ strategy: 'review', for: 'plan' }, t.deps);
  assert.deepEqual(t.resolverCalls().map(([verb]) => verb), ['probe']);
});

test('a review probes for run', async () => {
  const t = commandDeps();
  await run(review, t.deps);
  assert.equal(probes(t.resolverCalls())[0].verb, 'run');
});

test('a handoff probes for start', async () => {
  const t = commandDeps();
  await run(handoff, t.deps);
  assert.equal(probes(t.resolverCalls())[0].verb, 'start');
});

test('a resolver that declines the probe passes it down the chain', async () => {
  const t = commandDeps({ resolver: false, config: `version: 2\nresolvers: [${FAKE_RESOLVER}, subagent]\n`,
    settings: { FAKE_RESOLVER_EXIT_PROBE: '75', FAKE_RESOLVER_STDOUT_PROBE: '' } });
  assert.equal(await run(handoff, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
});

test('the guidance for the intent comes from the config', async () => {
  const t = listingFake('delegations:\n  code:\n    guidance: Use the strongest gpt model.\n');
  assert.equal(await run(review, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).guidance, 'Use the strongest gpt model.');
});

test('guidance for another intent only is null', async () => {
  const t = listingFake('delegations:\n  code:\n    guidance: Use gpt.\n');
  await run({ strategy: 'review', for: 'plan' }, t.deps);
  assert.equal(JSON.parse(t.stdout()).guidance, null);
});

test('a multi-line block keeps its lines', async () => {
  const t = listingFake('delegations:\n  apply:\n    guidance: |\n      Prefer claude.\n      Never gemini.\n');
  await run(handoff, t.deps);
  assert.equal(JSON.parse(t.stdout()).guidance, 'Prefer claude.\nNever gemini.\n');
});

test('malformed guidance is exit 2, naming the file and the key, and asks no resolver', async () => {
  const t = listingFake('delegations:\n  code:\n    guidance: 42\n');
  assert.equal(await run(review, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`${CONFIG}.*delegations\\.code\\.guidance`));
  assert.deepEqual(t.resolverCalls(), []);
});

test('a bad entry for another intent is not checked', async () => {
  const t = listingFake('delegations:\n  plan:\n    guidance: [a, b]\n');
  assert.equal(await run(review, t.deps), 0);
});

test('a chain where every resolver declines is exit 2, naming the config file', async () => {
  const t = listingFake('', { FAKE_RESOLVER_EXIT_PROBE: '75', FAKE_RESOLVER_STDOUT_PROBE: '' });
  assert.equal(await run(review, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`every resolver declined.*${CONFIG}`));
});

test('a listed resolver that is missing is exit 2, naming the path and the config file', async () => {
  const t = commandDeps({ resolver: false, config: 'version: 2\nresolvers: [/gone/lets-delegate-t3]\n' });
  assert.equal(await run(review, t.deps), 2);
  assert.match(t.stderr(), new RegExp(`${CONFIG}.*/gone/lets-delegate-t3`));
});
