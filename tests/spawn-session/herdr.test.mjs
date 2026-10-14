import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter, agentArgs } from '../../skills/spawn-session/scripts/adapters/herdr.mjs';
import { ReviewerFailed, SpawnError, TimeoutError } from '../../skills/spawn-session/scripts/lib/errors.mjs';
import { fakeIo } from './fixtures/fake-io.mjs';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const CREATED = { stdout: JSON.stringify({ result: { root_pane: { pane_id: 'pane-9' }, tab: { tab_id: 'tab-3' } } }), stderr: '', code: 0 };
const OK = { stdout: '', stderr: '', code: 0 };

test('agent argv for each case', () => {
  assert.deepEqual(agentArgs({ kind: 'critique', family: 'gpt', model: null, effort: 'high', prompt: 'P', name: 'x', attended: false }),
    ['-s', 'read-only', 'P']);
  assert.deepEqual(agentArgs({ kind: 'critique', family: 'gpt', model: 'gpt-6.1-sol', effort: 'high', prompt: 'P', name: 'x', attended: false }),
    ['-s', 'read-only', '-m', 'gpt-6.1-sol', 'P']);
  assert.deepEqual(agentArgs({ kind: 'critique', family: 'claude', model: null, effort: 'low', prompt: 'P', name: 'x', attended: false }),
    ['--permission-mode', 'plan', '--effort', 'low', 'P']);
  assert.deepEqual(agentArgs({ kind: 'critique', family: 'claude', model: 'claude-fable-5-1', effort: 'low', prompt: 'P', name: 'x', attended: false }),
    ['--permission-mode', 'plan', '--effort', 'low', '--model', 'claude-fable-5-1', 'P']);
  assert.deepEqual(agentArgs({ kind: 'critique', family: 'gemini', model: null, effort: 'medium', prompt: 'P', name: 'x', attended: false }),
    ['--mode', 'plan', '--effort', 'medium', '-i', 'P']);
  assert.deepEqual(agentArgs({ kind: 'critique', family: 'gemini', model: 'gemini-3.8-flash-medium', effort: 'medium', prompt: 'P', name: 'x', attended: false }),
    ['--mode', 'plan', '--effort', 'medium', '--model', 'gemini-3.8-flash-medium', '-i', 'P']);
  assert.deepEqual(agentArgs({ kind: 'handoff', family: 'claude', model: null, effort: null, prompt: 'P', name: 'fix-login', attended: true }),
    ['--remote-control', 'fix-login', 'P']);
  assert.deepEqual(agentArgs({ kind: 'handoff', family: 'claude', model: 'claude-sonnet-5-5', effort: null, prompt: 'P', name: 'fix-login', attended: false }),
    ['--remote-control', 'fix-login', '--model', 'claude-sonnet-5-5', 'P']);
});
test('a prompt with quotes and a newline is one argv element', () => {
  for (const family of ['gpt', 'claude', 'gemini']) {
    const args = agentArgs({ kind: 'critique', family, model: null, effort: 'high', prompt: TRICKY, name: 'x', attended: false });
    assert.equal(args.at(-1), TRICKY);
  }
});

test('detect needs HERDR_ENV=1 and herdr on PATH', () => {
  assert.equal(createAdapter(fakeIo({ commands: ['herdr'] })).detect({ HERDR_ENV: '1' }), true);
  assert.equal(createAdapter(fakeIo({ commands: [] })).detect({ HERDR_ENV: '1' }), false);
  assert.equal(createAdapter(fakeIo({ commands: ['herdr'] })).detect({}), false);
  const adapter = createAdapter(fakeIo({ commands: ['herdr', 'codex'] }));
  assert.equal(adapter.name, 'herdr');
  assert.deepEqual(adapter.availableFamilies({ effort: 'low' }), { gpt: [null], claude: [], gemini: [] });
});

const critique = { kind: 'critique', name: 'x-plan-review', prompt: TRICKY, cwd: '/r', family: 'gpt', model: null, effort: 'high', attended: false, readOnly: true };
const herdrEnv = { PATH: '/bin', HERDR_ENV: '1', HERDR_WORKSPACE_ID: 'ws-1' };

test('spawn creates a tab, then starts the agent in its pane', async () => {
  const io = fakeIo({ env: herdrEnv, results: [CREATED, OK] });
  const handle = await createAdapter(io).spawn(critique);
  assert.deepEqual(handle, { id: 'x-plan-review', kind: 'agent', tab: 'tab-3', pane: 'pane-9', notReady: false });
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [
    ['herdr', ['tab', 'create', '--workspace', 'ws-1', '--cwd', '/r', '--label', 'x-plan-review', '--no-focus']],
    ['herdr', ['agent', 'start', 'x-plan-review', '--kind', 'codex', '--pane', 'pane-9', '--timeout', '60000', '--', '-s', 'read-only', TRICKY]],
  ]);
});
test('an agent that is not ready yet still returns a handle', async () => {
  for (const code of ['agent_not_ready', 'timeout']) {
    const io = fakeIo({ env: herdrEnv, results: [CREATED, { stdout: JSON.stringify({ error: { code } }), stderr: '', code: 1 }] });
    const handle = await createAdapter(io).spawn(critique);
    assert.equal(handle.notReady, true);
    assert.equal(io.calls.length, 2);
  }
});
test('any other start failure closes the tab and throws', async () => {
  const io = fakeIo({ env: herdrEnv, results: [CREATED, { stdout: JSON.stringify({ error: { code: 'unknown_kind' } }), stderr: 'bad kind', code: 1 }, OK] });
  await assert.rejects(createAdapter(io).spawn(critique), (error) => error instanceof SpawnError && /unknown_kind/.test(error.message) && /bad kind/.test(error.message));
  assert.deepEqual(io.calls[2][1], ['tab', 'close', 'tab-3']);
});

const HANDLE = { id: 'x-plan-review', kind: 'agent', tab: 'tab-3', pane: 'pane-9', notReady: false };

test('waitForResult waits for idle, done or blocked, then reads the output', async () => {
  const io = fakeIo({ env: herdrEnv, results: [{ stdout: 'idle\n', stderr: '', code: 0 }, { stdout: 'FINDINGS\n', stderr: '', code: 0 }] });
  assert.deepEqual(await createAdapter(io).waitForResult(HANDLE, { timeoutMs: 900000 }), { text: 'FINDINGS\n' });
  assert.deepEqual(io.calls.map(([, args]) => args), [
    ['agent', 'wait', 'x-plan-review', '--until', 'idle', '--until', 'done', '--until', 'blocked', '--timeout', '900000'],
    ['agent', 'read', 'x-plan-review', '--source', 'recent-unwrapped', '--lines', '400', '--format', 'text'],
  ]);
});
test('a failed wait is a timeout, and a blocked agent is a reviewer failure', async () => {
  await assert.rejects(createAdapter(fakeIo({ env: herdrEnv, results: [{ stdout: '', stderr: 'timed out', code: 1 }] })).waitForResult(HANDLE, { timeoutMs: 1 }), TimeoutError);
  await assert.rejects(createAdapter(fakeIo({ env: herdrEnv, results: [{ stdout: 'blocked\n', stderr: '', code: 0 }] })).waitForResult(HANDLE, { timeoutMs: 1 }),
    (error) => error instanceof ReviewerFailed && error.message === 'the reviewer is waiting for input');
});
test('finish closes the tab only on success', async () => {
  const io = fakeIo({ env: herdrEnv });
  const adapter = createAdapter(io);
  await adapter.finish(HANDLE, false);
  assert.equal(io.calls.length, 0);
  await adapter.finish(HANDLE, true);
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [['herdr', ['tab', 'close', 'tab-3']]]);
});
