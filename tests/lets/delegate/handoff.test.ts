import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/handoff.ts';
import { commandDeps, PROMPT_FILE } from './fixtures/command-deps.ts';

const options = { name: 'Fix Login', promptFile: 'p.md' };

test('a handoff prints the resolver and its handle as one JSON line', async () => {
  const t = commandDeps();
  assert.equal(await run(options, t.deps), 0);
  assert.equal(t.stdout(), '{"resolver":"fake","handle":{"kind":"fake","id":"f-1"}}\n');
  assert.equal(t.stderr(), '');
});

test('the start request has readOnly false and interactive true', async () => {
  const t = commandDeps();
  await run(options, t.deps);
  assert.deepEqual(t.resolverCalls(), [['start', {
    protocol: 1, cwd: '/repo', name: 'fix-login', prompt: 'PROMPT TEXT', readOnly: false, interactive: true,
  }]]);
});

test('the start request has no reviewers, whatever the config holds', async () => {
  const config = { version: 1, resolver: null, reviewers: [{ family: 'gpt', model: 'gpt-6-luna' }] };
  const t = commandDeps({ files: { [PROMPT_FILE]: 'PROMPT TEXT', '/home/u/.config/lets-delegate/config.json': JSON.stringify(config) } });
  await run(options, t.deps);
  assert.equal('reviewers' in t.resolverCalls()[0][1], false);
});

test('with no resolver, the default hands back the prompt and where it is saved', async () => {
  const t = commandDeps({ resolver: false, files: { '/repo/p.md': 'Run lets-build on branch build-x' } });
  assert.equal(await run({ name: 'build-x', promptFile: 'p.md' }, t.deps), 0);
  const { resolver, handle, instructions } = JSON.parse(t.stdout());
  assert.equal(resolver, 'default');
  assert.equal(handle, null);
  assert.match(instructions, /Run lets-build on branch build-x/);
  assert.match(instructions, /\.workspace\/lets-delegate\/build-x\.prompt\.md/);
  assert.equal(t.io.files.get('/repo/.workspace/lets-delegate/build-x.prompt.md'), 'Run lets-build on branch build-x');
});

test('the default\'s handoff instructions are the same whichever CLIs are on PATH, and name none', async () => {
  const answer = async (commands: string[]) => {
    const t = commandDeps({ resolver: false, commands });
    assert.equal(await run(options, t.deps), 0);
    return JSON.parse(t.stdout()).instructions as string;
  };
  const withClis = await answer(['claude', 'codex', 'agy']);
  assert.equal(withClis, await answer([]));
  assert.doesNotMatch(withClis, /\b(claude|codex|agy)\b/);
});

test('a null handle with no instructions is exit 4', async () => {
  const t = commandDeps({ settings: { FAKE_RESOLVER_STDOUT_START: '{"resolver":"fake","handle":null}' } });
  assert.equal(await run(options, t.deps), 4);
  assert.match(t.stderr(), /broke the contract.*instructions/);
  assert.equal(t.stdout(), '');
});

test('any failure of the resolver is exit 4', async () => {
  for (const resolverExit of ['3', '5', '6', '2', '1']) {
    const t = commandDeps({ settings: { FAKE_RESOLVER_EXIT_START: resolverExit, FAKE_RESOLVER_STDOUT_START: '', FAKE_RESOLVER_STDERR: 'harness said no' } });
    assert.equal(await run(options, t.deps), 4, `resolver exit ${resolverExit}`);
    assert.match(t.stderr(), /harness said no/);
  }
});

test('a prompt file that cannot be read is exit 2, naming it', async () => {
  const t = commandDeps({ files: {} });
  assert.equal(await run(options, t.deps), 2);
  assert.match(t.stderr(), /p\.md/);
  assert.deepEqual(t.resolverCalls(), []);
});
