import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/handoff.ts';
import { SessionFailed, SpawnError, TimeoutError } from '../../../lets/src/resolvers/kit/errors.ts';
import { commandDeps, CONFIG, PROMPT_FILE } from './fixtures/command-deps.ts';

const options = { name: 'Fix Login', promptFile: 'p.md', models: ['claude'] };

// commandDeps whose config lists t3, which answers, and more as given.
const withT3 = (over: Parameters<typeof commandDeps>[0] = {}) =>
  commandDeps({ config: 'version: 3\ndelegate: { resolvers: [t3] }\n', ...over, adapters: { t3: {}, ...over.adapters } });
type Calls = ReturnType<typeof commandDeps>['adapterCalls'];
const startModels = (calls: Calls) => calls('start').map(([, , input]) => {
  const { family, model } = input as { family: string; model: string | null };
  return model === null ? family : `${family}/${model}`;
});
const subagentAsked = (calls: Calls) => calls().some(([name]) => name === 'subagent');

test('a handoff prints the resolver and its handle as one JSON line', async () => {
  const t = withT3();
  assert.equal(await run(options, t.deps), 0);
  assert.equal(t.stdout(), '{"resolver":"t3","handle":{"kind":"t3","id":"t3-1"}}\n');
  assert.equal(t.stderr(), '');
});

test('the adapter is asked to start the normalized name, the prompt, the family and the model', async () => {
  const t = withT3();
  await run({ ...options, models: ['gpt/gpt-6-luna'] }, t.deps);
  assert.deepEqual(t.adapterCalls('start'), [['t3', 'start', { name: 'fix-login', prompt: 'PROMPT TEXT', cwd: '/repo', family: 'gpt', model: 'gpt-6-luna' }]]);
});

test('the start request has no reviewers, whatever the config holds', async () => {
  const t = withT3({ config: 'version: 3\ndelegate: { resolvers: [t3] }\nreviewers:\n  - family: gpt\n    model: gpt-6-luna\n' });
  assert.equal(await run(options, t.deps), 0);
  assert.equal('reviewers' in (t.adapterCalls('start')[0][2] as object), false);
});

test('a resolver that starts no session prints a null handle and its instructions', async () => {
  const t = withT3({ adapters: { t3: { start: { instructions: 'Carry on by hand.' } } } });
  assert.equal(await run(options, t.deps), 0);
  assert.equal(t.stdout(), '{"resolver":"t3","handle":null,"instructions":"Carry on by hand."}\n');
});

test('a bad --model is exit 2, naming it, and no resolver is asked', async () => {
  const t = withT3();
  assert.equal(await run({ ...options, models: ['claude', 'llama/llama-4'] }, t.deps), 2);
  assert.match(t.stderr(), /llama\/llama-4/);
  assert.deepEqual(t.adapterCalls(), []);
});

test('a listed resolver that declines passes the handoff to the subagent entry', async () => {
  const t = withT3({ config: 'version: 3\ndelegate: { resolvers: [t3, subagent] }\n', adapters: { t3: { declines: true } } });
  assert.equal(await run(options, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
});

test('a headless resolver starts nothing, and the next one answers', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [cli, subagent] }\n', adapters: { cli: { headless: true } } });
  assert.equal(await run(options, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
  assert.equal(t.adapterCalls().some(([name]) => name === 'cli'), false);
});

test('a chain that leaves out the default is exit 2 when its resolver declines, and the default is not asked', async () => {
  const t = withT3({ adapters: { t3: { declines: true } } });
  assert.equal(await run(options, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`every resolver declined.*${CONFIG}`));
  assert.equal(subagentAsked(t.adapterCalls), false);
});

test('an empty chain is exit 2 with nothing on stdout', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [] }\n' });
  assert.equal(await run(options, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /every resolver declined/);
});

test('a name lets does not know is exit 2, naming it and the config file', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [codex] }\n' });
  assert.equal(await run(options, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), new RegExp(`${CONFIG}.*codex`));
});

test('a bad entry after one that would answer is exit 2, and saves no prompt', async () => {
  const t = commandDeps({ config: 'version: 3\ndelegate: { resolvers: [subagent, /opt/r/old-resolver] }\n' });
  assert.equal(await run(options, t.deps), 2);
  assert.equal(t.savedFile('.workspace/lets-delegate/fix-login.prompt.md'), null);
  assert.deepEqual(t.adapterCalls(), []);
});

test('a config.json with no config.yaml is not read, and the default answers', async () => {
  const t = commandDeps({ files: { [PROMPT_FILE]: 'PROMPT TEXT', '/home/u/.config/lets/config.json': '{}' } });
  assert.equal(await run(options, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
});

test('with no config, the default hands back the prompt and where it is saved', async () => {
  const t = commandDeps({ files: { '/repo/p.md': 'Run lets-build on branch build-x' } });
  assert.equal(await run({ name: 'build-x', promptFile: 'p.md', models: ['claude'] }, t.deps), 0);
  const { resolver, handle, instructions } = JSON.parse(t.stdout());
  assert.equal(resolver, 'subagent');
  assert.equal(handle, null);
  assert.match(instructions, /Run lets-build on branch build-x/);
  assert.match(instructions, /\.workspace\/lets-delegate\/build-x\.prompt\.md/);
  assert.equal(t.savedFile('.workspace/lets-delegate/build-x.prompt.md'), 'Run lets-build on branch build-x');
});

test('a config with no chain asks the default', async () => {
  for (const config of ['version: 3\n', 'version: 3\ndelegate:\n', 'version: 3\ndelegate:\n  review:\n    code:\n      guidance: Use gpt.\n']) {
    const t = commandDeps({ config, files: { [PROMPT_FILE]: 'PROMPT TEXT' } });
    assert.equal(await run(options, t.deps), 0, config);
    assert.equal(JSON.parse(t.stdout()).resolver, 'subagent', config);
  }
});

test('a version 2 config is exit 2, saying the version must be 3', async () => {
  const t = commandDeps({ config: 'version: 2\nresolvers: [subagent]\n', files: { [PROMPT_FILE]: 'PROMPT TEXT' } });
  assert.equal(await run(options, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.ok(t.stderr().includes(CONFIG), t.stderr());
  assert.match(t.stderr(), /version must be 3, got 2/);
});

test('a refused model passes to the next one on the same resolver', async () => {
  const t = withT3({ adapters: { t3: { refuse: ['gpt/gpt-6-astra'] } } });
  assert.equal(await run({ ...options, models: ['gpt/gpt-6-astra', 'claude'] }, t.deps), 0);
  assert.deepEqual(startModels(t.adapterCalls), ['gpt/gpt-6-astra', 'claude']);
});

test('a handoff whose every model is refused is exit 3, naming each model', async () => {
  const t = withT3({ adapters: { t3: { refuse: ['gpt/gpt-6-astra', 'claude'] } } });
  assert.equal(await run({ ...options, models: ['gpt/gpt-6-astra', 'claude'] }, t.deps), 3);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /gpt\/gpt-6-astra: refused gpt\/gpt-6-astra\nclaude: refused claude/);
});

test('a refusal never moves down the chain', async () => {
  const t = withT3({ config: 'version: 3\ndelegate: { resolvers: [t3, subagent] }\n', adapters: { t3: { refuse: ['gpt', 'claude'] } } });
  assert.equal(await run({ ...options, models: ['gpt', 'claude'] }, t.deps), 3);
  assert.equal(subagentAsked(t.adapterCalls), false, 'the default was not asked');
});

test('any other failure of the resolver is exit 4 with its message, never 5 or 6', async () => {
  for (const error of [new SessionFailed('harness said no'), new TimeoutError('harness said no'), new SpawnError('harness said no'), new Error('harness said no')]) {
    const t = withT3({ adapters: { t3: { start: error } } });
    assert.equal(await run({ ...options, models: ['claude', 'gpt'] }, t.deps), 4, error.constructor.name);
    assert.equal(t.stdout(), '');
    assert.match(t.stderr(), /harness said no/);
    assert.deepEqual(startModels(t.adapterCalls), ['claude'], 'the next model is not asked');
  }
});

test('a prompt file that cannot be read is exit 2, naming it', async () => {
  const t = withT3({ files: {} });
  assert.equal(await run(options, t.deps), 2);
  assert.match(t.stderr(), /p\.md/);
  assert.deepEqual(t.adapterCalls(), []);
});
