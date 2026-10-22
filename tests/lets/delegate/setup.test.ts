import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsageError } from '../../../lets/src/delegate/errors.ts';
import { detect, propose, run } from '../../../lets/src/delegate/setup.ts';
import type { Findings } from '../../../lets/src/delegate/setup.ts';
import type { Deps, ExecResult } from '../../../lets/src/io.ts';
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

const CONFIG = '/home/u/.config/lets-delegate/config.json';
// Deps for the command: t3, the resolver and the three CLIs on PATH, the
// model lists answered, and the files given.
function setupDeps({ files = {} as Record<string, string>, env = {} as Record<string, string>, codex = ok(CODEX_MODELS) } = {}) {
  const io = fakeIo({
    files,
    commands: ['t3', 'lets-delegate-resolver', 'codex', 'claude', 'agy'],
    executables: ['/b/lets-delegate-resolver'],
    results: [(cmd: string) => (cmd === 'codex' ? codex : ok(AGY_MODELS)), (cmd: string) => (cmd === 'codex' ? codex : ok(AGY_MODELS))],
  });
  const out: string[] = [];
  const err: string[] = [];
  const deps: Deps = { env: { PATH: '/b', ...env }, cwd: '/r', packageRoot: '/pkg', nodePath: process.execPath, io, stdout: (t) => out.push(t), stderr: (t) => err.push(t) };
  return { deps, io, stdout: () => out.join(''), stderr: () => err.join('') };
}
const PROPOSED = {
  version: 1, resolver: '/b/lets-delegate-resolver',
  reviewers: [{ family: 'gpt', model: 'gpt-6-luna' }, { family: 'claude', model: null }, { family: 'gemini', model: 'gemini-3.8-flash' }],
};

test('a plain run writes no file and exits 0', async () => {
  const t = setupDeps();
  assert.equal(await run({}, t.deps), 0);
  assert.equal(t.io.files.has(CONFIG), false);
});

test('--write writes the proposal to the config file, and names its path', async () => {
  const t = setupDeps();
  assert.equal(await run({ write: true }, t.deps), 0);
  assert.deepEqual(JSON.parse(t.io.files.get(CONFIG)!), PROPOSED);
  assert.match(t.stdout(), new RegExp(CONFIG));
});

test('--write writes under XDG_CONFIG_HOME when it is set', async () => {
  const t = setupDeps({ env: { XDG_CONFIG_HOME: '/tmp/cfg' } });
  await run({ write: true }, t.deps);
  assert.equal(t.io.files.has('/tmp/cfg/lets-delegate/config.json'), true);
});

test('--json prints one object with the harness, the families, the current config and the proposal', async () => {
  const t = setupDeps();
  await run({ json: true }, t.deps);
  const printed = JSON.parse(t.stdout());
  assert.deepEqual(Object.keys(printed).sort(), ['current', 'families', 'harness', 'proposed']);
  assert.deepEqual(printed.proposed, PROPOSED);
});

test('a failed list shows in --json, and its family is proposed with a null model', async () => {
  const t = setupDeps({ codex: { stdout: '', stderr: 'not logged in', code: 1 } });
  await run({ json: true }, t.deps);
  const { families, proposed } = JSON.parse(t.stdout());
  assert.equal(families.gpt.available, true);
  assert.deepEqual(families.gpt.models, []);
  assert.match(families.gpt.error, /not logged in/);
  assert.deepEqual(proposed.reviewers[0], { family: 'gpt', model: null });
});

test('running setup again shows the current config beside the proposal, and leaves the file alone', async () => {
  const current = JSON.stringify({ version: 1, resolver: '/a/resolver', reviewers: [{ family: 'claude', model: null }] });
  const t = setupDeps({ files: { [CONFIG]: current } });
  await run({ json: true }, t.deps);
  assert.deepEqual(JSON.parse(t.stdout()).current, JSON.parse(current));
  assert.equal(t.io.files.get(CONFIG), current);
});

test('in plain text the current config is under Current and the proposal under Proposed', async () => {
  const t = setupDeps({ files: { [CONFIG]: JSON.stringify({ version: 1, resolver: '/a/resolver', reviewers: [] }) } });
  await run({}, t.deps);
  assert.match(t.stdout(), /^Current\b[\s\S]*\/a\/resolver[\s\S]*^Proposed\b[\s\S]*\/b\/lets-delegate-resolver/m);
});

test('a current config that cannot be read is named, and the proposal still shows', async () => {
  const t = setupDeps({ files: { [CONFIG]: '{"version":9}' } });
  assert.equal(await run({ json: true }, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).current, null);
  assert.deepEqual(JSON.parse(t.stdout()).proposed, PROPOSED);
  assert.match(t.stderr(), /cannot be read.*version/);
});

test('--order and --model change what --write writes', async () => {
  const t = setupDeps();
  await run({ order: 'gemini,gpt', model: ['gpt=gpt-5.6-terra'], write: true }, t.deps);
  assert.deepEqual(JSON.parse(t.io.files.get(CONFIG)!).reviewers,
    [{ family: 'gemini', model: 'gemini-3.8-flash' }, { family: 'gpt', model: 'gpt-5.6-terra' }]);
});

test('a flag that names an unknown family exits 2, names it, writes nothing and runs no list command', async () => {
  const t = setupDeps();
  assert.equal(await run({ model: ['mistral=large'], write: true }, t.deps), 2);
  assert.match(t.stderr(), /mistral/);
  assert.equal(t.io.files.has(CONFIG), false);
  assert.deepEqual(t.io.calls, []);
});

test('a family named twice in --order or --model is a usage error that names it', () => {
  assert.throws(() => propose(findings(), { order: 'gpt,gpt' }), usageNaming('gpt'));
  assert.throws(() => propose(findings(), { model: ['gpt=a', 'gpt=b'] }), usageNaming('gpt'));
});
