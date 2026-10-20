import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsageError } from '../../../lets/src/delegate/errors.ts';
import { detect, propose } from '../../../lets/src/delegate/setup.ts';
import type { Findings } from '../../../lets/src/delegate/setup.ts';
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

test('detect finds the path of the resolver on PATH, as PATH gives it', async () => {
  const io = fakeIo({ executables: ['/home/u/.nix-profile/bin/lets-delegate-resolver'] });
  assert.equal((await detect({ env: { PATH: '/usr/bin:/home/u/.nix-profile/bin' }, io })).resolver, '/home/u/.nix-profile/bin/lets-delegate-resolver');
});

const RESOLVER = '/home/u/.nix-profile/bin/lets-delegate-resolver';
// Findings with t3 on PATH, the resolver found, and all three families.
const findings = (over: Partial<Findings> = {}): Findings => ({
  harness: { name: 't3', onPath: { t3: true, herdr: false } },
  families: {
    gpt: { cli: 'codex', available: true, models: ['gpt-6-luna', 'gpt-5.6-terra'] },
    claude: { cli: 'claude', available: true, models: [] },
    gemini: { cli: 'agy', available: true, models: ['gemini-3.8-flash'] },
  },
  resolver: RESOLVER,
  ...over,
});
const usageNaming = (name: string) => (error: unknown) => error instanceof UsageError && error.message.includes(name);

test('the proposal has one reviewer per available family, gpt then claude then gemini, with the first model listed', () => {
  assert.deepEqual(propose(findings(), {}), {
    version: 1,
    resolver: RESOLVER,
    reviewers: [{ family: 'gpt', model: 'gpt-6-luna' }, { family: 'claude', model: null }, { family: 'gemini', model: 'gemini-3.8-flash' }],
  });
});

test('the proposal leaves out a family that is not available', () => {
  const { families } = findings();
  const proposal = propose(findings({ families: { ...families, gemini: { ...families.gemini, available: false, models: [] } } }), {});
  assert.deepEqual(proposal.reviewers.map(({ family }) => family), ['gpt', 'claude']);
});

test('the proposed resolver is null when neither t3 nor herdr is on PATH', () => {
  assert.equal(propose(findings({ harness: { name: 'none', onPath: { t3: false, herdr: false } } }), {}).resolver, null);
});

test('the proposed resolver is null when no resolver is on PATH', () => {
  assert.equal(propose(findings({ resolver: null }), {}).resolver, null);
});

test('--order sets the reviewers\' order and drops the families it leaves out', () => {
  assert.deepEqual(propose(findings(), { order: 'gemini,gpt' }).reviewers.map(({ family }) => family), ['gemini', 'gpt']);
});

test('--model sets one family\'s model', () => {
  assert.deepEqual(propose(findings(), { model: ['gpt=gpt-5.6-terra'] }).reviewers[0], { family: 'gpt', model: 'gpt-5.6-terra' });
});

test('--resolver sets the resolver, and none sets it to null', () => {
  assert.equal(propose(findings(), { resolver: '/opt/r/resolver' }).resolver, '/opt/r/resolver');
  assert.equal(propose(findings(), { resolver: 'none' }).resolver, null);
});

test('a flag that names an unknown family is a usage error that names it', () => {
  assert.throws(() => propose(findings(), { model: ['mistral=large'] }), usageNaming('mistral'));
  assert.throws(() => propose(findings(), { order: 'gpt,mistral' }), usageNaming('mistral'));
});

test('a flag that names a family that is not available is a usage error that names it', () => {
  const { families } = findings();
  const noGemini = findings({ families: { ...families, gemini: { ...families.gemini, available: false } } });
  assert.throws(() => propose(noGemini, { order: 'gemini,gpt' }), usageNaming('gemini'));
  assert.throws(() => propose(noGemini, { model: ['gemini=gemini-3.8-flash'] }), usageNaming('gemini'));
});

test('a malformed --model or a relative --resolver is a usage error that names it', () => {
  assert.throws(() => propose(findings(), { model: ['gpt'] }), usageNaming('gpt'));
  assert.throws(() => propose(findings(), { resolver: 'bin/r' }), usageNaming('bin/r'));
});
