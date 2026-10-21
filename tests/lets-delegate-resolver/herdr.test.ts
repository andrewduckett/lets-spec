import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SpawnRequest } from '../../contrib/lets-delegate-resolver/src/adapter.ts';
import { SessionFailed, SpawnError, TimeoutError } from '../../contrib/resolver-kit/src/errors.ts';
import { agentArgs, createAdapter } from '../../contrib/lets-delegate-resolver/src/herdr.ts';
import type { ExecResult } from '../../contrib/resolver-kit/src/io.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const CREATED = { stdout: JSON.stringify({ result: { root_pane: { pane_id: 'pane-9' }, tab: { tab_id: 'tab-3' } } }), stderr: '', code: 0 };
const OK = { stdout: '', stderr: '', code: 0 };

const args = (over: Partial<SpawnRequest>) => agentArgs({ kind: 'run', family: 'gpt', model: null, effort: 'high', prompt: 'P', name: 'x', ...over });

test('agent argv for each case: a run starts idle, a start carries its prompt', () => {
  assert.deepEqual(args({}), ['-s', 'read-only']);
  assert.deepEqual(args({ model: 'gpt-6.1-sol' }), ['-s', 'read-only', '-m', 'gpt-6.1-sol']);
  assert.deepEqual(args({ family: 'claude', effort: 'low' }), ['--permission-mode', 'plan', '--effort', 'low']);
  assert.deepEqual(args({ family: 'claude', effort: 'low', model: 'claude-fable-5-1' }),
    ['--permission-mode', 'plan', '--effort', 'low', '--model', 'claude-fable-5-1']);
  assert.deepEqual(args({ family: 'gemini', effort: 'medium' }), ['--mode', 'plan', '--effort', 'medium']);
  assert.deepEqual(args({ family: 'gemini', effort: 'medium', model: 'gemini-3.8-flash-medium' }),
    ['--mode', 'plan', '--effort', 'medium', '--model', 'gemini-3.8-flash-medium']);
  assert.deepEqual(args({ kind: 'start', family: 'claude', effort: null, name: 'fix-login' }), ['--remote-control', 'fix-login', 'P']);
});
test('a gemini model without an effort suffix runs with the effort added', () => {
  assert.deepEqual(args({ family: 'gemini', effort: 'high', model: 'gemini-3.8-flash' }),
    ['--mode', 'plan', '--effort', 'high', '--model', 'gemini-3.8-flash-high']);
});

test('a family herdr cannot run is one whose executor is not on PATH', () => {
  assert.equal(createAdapter(fakeIo({ commands: ['herdr'] })).whyNot?.('gpt'), 'codex is not on PATH');
});

test('a start prompt with quotes and a newline is one argv element', () => {
  assert.equal(args({ kind: 'start', family: 'claude', effort: null, prompt: TRICKY }).at(-1), TRICKY);
});

test('detect needs HERDR_ENV=1 and herdr on PATH', () => {
  assert.equal(createAdapter(fakeIo({ commands: ['herdr'], env: { HERDR_ENV: '1' } })).detect(), true);
  assert.equal(createAdapter(fakeIo({ commands: [], env: { HERDR_ENV: '1' } })).detect(), false);
  assert.equal(createAdapter(fakeIo({ commands: ['herdr'], env: {} })).detect(), false);
  const adapter = createAdapter(fakeIo({ commands: ['herdr', 'codex'] }));
  assert.equal(adapter.name, 'herdr');
  assert.deepEqual(adapter.availableFamilies({ effort: 'low' }), { gpt: [null], claude: [], gemini: [] });
});

const run: SpawnRequest = { kind: 'run', name: 'x-plan-review', prompt: TRICKY, cwd: '/r', family: 'gpt', model: null, effort: 'high', readOnly: true };
const herdrEnv = { PATH: '/bin', HERDR_ENV: '1', HERDR_WORKSPACE_ID: 'ws-1', CLAUDECODE: '1' };

test('spawn creates a tab, then starts the agent idle in its pane; the handle is the tab', async () => {
  const io = fakeIo({ env: herdrEnv, results: [CREATED, OK] });
  const session = await createAdapter(io).spawn(run);
  assert.deepEqual(session, { handle: { kind: 'tab', id: 'tab-3', agent: 'x-plan-review' }, agent: 'x-plan-review', prompt: TRICKY, notReady: false });
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [
    ['herdr', ['tab', 'create', '--workspace', 'ws-1', '--cwd', '/r', '--label', 'x-plan-review', '--no-focus']],
    ['herdr', ['agent', 'start', 'x-plan-review', '--kind', 'codex', '--pane', 'pane-9', '--timeout', '60000', '--', '-s', 'read-only']],
  ]);
  assert.equal(io.calls[0][2].env?.CLAUDECODE, undefined, 'herdr runs without the session markers');
});
test('spawn refuses to run without a workspace id', async () => {
  const io = fakeIo({ env: { PATH: '/bin' } });
  await assert.rejects(createAdapter(io).spawn(run), (error) => error instanceof SpawnError && /HERDR_WORKSPACE_ID/.test(error.message));
  assert.equal(io.calls.length, 0);
});
test('an agent that is not ready yet still returns a session; herdr reports errors as JSON on stderr', async () => {
  for (const code of ['agent_not_ready', 'timeout']) {
    const io = fakeIo({ env: herdrEnv, results: [CREATED, { stdout: '', stderr: JSON.stringify({ error: { code } }), code: 1 }] });
    const session = await createAdapter(io).spawn(run);
    assert.equal(session.notReady, true);
    assert.equal(io.calls.length, 2);
  }
});
test('any other start failure closes the tab and throws', async () => {
  const io = fakeIo({ env: herdrEnv, results: [CREATED, { stdout: '', stderr: JSON.stringify({ error: { code: 'unknown_kind', message: 'bad kind' } }), code: 1 }, OK] });
  await assert.rejects(createAdapter(io).spawn(run), (error) => error instanceof SpawnError && /unknown_kind/.test(error.message) && /bad kind/.test(error.message));
  assert.deepEqual(io.calls[2][1], ['tab', 'close', 'tab-3']);
});

const SESSION = { handle: { kind: 'tab', id: 'tab-3', agent: 'x-plan-review' }, agent: 'x-plan-review', prompt: TRICKY, notReady: false };
const settled = (state: string) => ({ stdout: JSON.stringify({ id: 'cli:agent:prompt', result: { state } }), stderr: '', code: 0 });
const failed = (code: string) => ({ stdout: '', stderr: JSON.stringify({ error: { code } }), code: 1 });

test('waitForResult submits the prompt, waits for a settled state, then reads the output', async () => {
  const io = fakeIo({ env: herdrEnv, results: [settled('idle'), { stdout: 'FINDINGS\n', stderr: '', code: 0 }] });
  assert.deepEqual(await createAdapter(io).waitForResult(SESSION, { timeoutMs: 900000 }), { text: 'FINDINGS\n' });
  assert.deepEqual(io.calls.map(([, args]) => args), [
    ['agent', 'prompt', 'x-plan-review', TRICKY, '--wait', '--timeout', '900000'],
    ['agent', 'read', 'x-plan-review', '--source', 'recent-unwrapped', '--lines', '2000', '--format', 'text'],
  ]);
});
test('a timeout is a TimeoutError; blocked and stalled agents are session failures', async () => {
  const wait = (result: ExecResult) => createAdapter(fakeIo({ env: herdrEnv, results: [result] })).waitForResult(SESSION, { timeoutMs: 1 });
  await assert.rejects(wait(failed('timeout')), TimeoutError);
  await assert.rejects(wait(settled('blocked')), (error) => error instanceof SessionFailed && error.message === 'the session is waiting for input');
  await assert.rejects(wait(failed('agent_blocked')), (error) => error instanceof SessionFailed && /agent_blocked/.test(error.message));
  await assert.rejects(wait(failed('agent_prompt_stalled')), (error) => error instanceof SessionFailed && /agent_prompt_stalled/.test(error.message));
});
test('finish closes the tab only on ok, and throws when herdr cannot', async () => {
  const io = fakeIo({ env: herdrEnv });
  const adapter = createAdapter(io);
  await adapter.finish(SESSION.handle, false);
  assert.equal(io.calls.length, 0);
  await adapter.finish(SESSION.handle, true);
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [['herdr', ['tab', 'close', 'tab-3']]]);
  const gone = createAdapter(fakeIo({ env: herdrEnv, results: [failed('tab_not_found')] }));
  await assert.rejects(gone.finish(SESSION.handle, true), (error) => error instanceof SpawnError && /tab_not_found/.test(error.message));
});
