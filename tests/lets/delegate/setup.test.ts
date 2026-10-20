import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect } from '../../../lets/src/delegate/setup.ts';
import type { ExecResult } from '../../../lets/src/io.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
// The deps detect takes: commands on PATH, a T3 runtime file naming pid 7,
// and a parent chain 100 -> 50 -> 7 -> 1, unless replaced.
function detectDeps({ commands = [] as string[], env = {} as Record<string, string>, files = { [RUNTIME]: '{"pid":7,"origin":"http://127.0.0.1:3773"}' } as Record<string, string>, chain = { 100: 50, 50: 7, 7: 1 } as Record<number, number> } = {}) {
  const io = fakeIo({ commands, files, pid: 100, parentPid: (pid: number) => chain[pid] ?? null, processAlive: (pid: number) => pid === 7 });
  return { env, io };
}

test('the harness is t3 when the T3 server is alive and one of the parents', async () => {
  assert.equal((await detect(detectDeps())).harness.name, 't3');
});

test('the harness is not t3 when the T3 server is not one of the parents', async () => {
  assert.equal((await detect(detectDeps({ chain: { 100: 50, 50: 1 } }))).harness.name, 'none');
});

test('the harness is herdr when HERDR_ENV is 1 and herdr is on PATH', async () => {
  const deps = detectDeps({ files: {}, commands: ['herdr'], env: { HERDR_ENV: '1' } });
  assert.equal((await detect(deps)).harness.name, 'herdr');
});

test('from a plain terminal the harness is none, and says which harness tools are on PATH', async () => {
  const { harness } = await detect(detectDeps({ files: {}, commands: ['t3'] }));
  assert.deepEqual(harness, { name: 'none', onPath: { t3: true, herdr: false } });
});

test('a family is available when its CLI is on PATH', async () => {
  const { families } = await detect(detectDeps({ files: {}, commands: ['codex', 'claude'] }));
  assert.deepEqual([families.gpt.available, families.claude.available, families.gemini.available], [true, true, false]);
  assert.deepEqual([families.gpt.cli, families.claude.cli, families.gemini.cli], ['codex', 'claude', 'agy']);
});

const CODEX_MODELS = JSON.stringify({ models: [
  { slug: 'gpt-reserve', visibility: 'hide' }, { slug: 'gpt-6-luna', visibility: 'list' }, { slug: 'gpt-5.6-terra', visibility: 'list' },
] });
const AGY_MODELS = 'gemini-3.8-flash-high\tGemini 3.8 Flash (High)\ngemini-3.8-flash-low\tGemini 3.8 Flash (Low)\n'
  + 'claude-sonnet-4-6\tClaude Sonnet 4.6\ngemini-3.9-pro-medium\tGemini 3.9 Pro (Medium)\n';
// Answers the model list commands; codex and agy are on PATH.
function listDeps(answers: Record<string, ExecResult | Promise<ExecResult>>) {
  const io = fakeIo({
    commands: ['codex', 'agy'],
    results: [(cmd: string) => answers[cmd], (cmd: string) => answers[cmd]],
  });
  return { env: {}, io };
}
const ok = (stdout: string): ExecResult => ({ stdout, stderr: '', code: 0 });

test('gpt lists the models codex reports as listed, in order', async () => {
  const { families } = await detect(listDeps({ codex: ok(CODEX_MODELS), agy: ok(AGY_MODELS) }));
  assert.deepEqual(families.gpt.models, ['gpt-6-luna', 'gpt-5.6-terra']);
});

test('gemini lists the gemini models agy reports, once each, without the effort suffix', async () => {
  const { families } = await detect(listDeps({ codex: ok(CODEX_MODELS), agy: ok(AGY_MODELS) }));
  assert.deepEqual(families.gemini.models, ['gemini-3.8-flash', 'gemini-3.9-pro']);
});

test('setup runs no command of the family CLIs but their model lists', async () => {
  const deps = listDeps({ codex: ok(CODEX_MODELS), agy: ok(AGY_MODELS) });
  deps.io.commandExists = (cmd) => ['codex', 'claude', 'agy'].includes(cmd);
  await detect(deps);
  assert.deepEqual(deps.io.calls.map(([cmd, args]) => [cmd, ...args]), [['codex', 'debug', 'models'], ['agy', 'models']]);
});

test('a list command that fails leaves the family available with no models and its stderr as the error', async () => {
  const { families } = await detect(listDeps({ codex: { stdout: '', stderr: 'not logged in', code: 1 }, agy: ok(AGY_MODELS) }));
  assert.equal(families.gpt.available, true);
  assert.deepEqual(families.gpt.models, []);
  assert.match(families.gpt.error!, /not logged in/);
});

test('a list that does not parse is a failed list', async () => {
  const { families } = await detect(listDeps({ codex: ok('Usage: codex debug ...'), agy: ok('') }));
  assert.deepEqual([families.gpt.models, families.gemini.models], [[], []]);
  assert.match(families.gpt.error!, /codex debug models/);
  assert.match(families.gemini.error!, /agy models/);
});

test('a list command that does not answer in time is a failed list', async () => {
  const { families } = await detect(listDeps({ codex: new Promise(() => {}), agy: ok(AGY_MODELS) }));
  assert.deepEqual(families.gpt.models, []);
  assert.match(families.gpt.error!, /30 seconds/);
});
