import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../lets/src/delegate/handoff.ts';
import { commandDeps } from './fixtures/command-deps.ts';

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

test('with no resolver, the default answers with instructions and no handle', async () => {
  const t = commandDeps({ resolver: false, commands: ['claude'] });
  assert.equal(await run(options, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), {
    resolver: 'default',
    handle: null,
    instructions: 'Open a terminal in /repo and run: claude "$(cat .workspace/lets-delegate/fix-login.prompt.md)"',
  });
  assert.equal(t.io.files.get('/repo/.workspace/lets-delegate/fix-login.prompt.md'), 'PROMPT TEXT');
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
