import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run } from '../../../lets/src/delegate/verify.ts';
import { realIo } from '../../../lets/src/io.ts';
import type { Deps } from '../../../lets/src/io.ts';

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));
const SUBAGENT = fileURLToPath(new URL('../../../lets/resolvers/lets-delegate-subagent', import.meta.url));
const EXAMPLE = fileURLToPath(new URL('../../../lets/resolvers/headless-resolver', import.meta.url));

// Real deps in a fresh git repo. settings go into the env of each command
// the check runs, for the fake resolver.
function setup(settings: Record<string, string> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'lets-verify-'));
  execFileSync('git', ['init', '--quiet'], { cwd });
  const io = realIo();
  const out: string[] = [];
  const deps: Deps = {
    env: {}, cwd, packageRoot: '/pkg',
    // verify runs the resolver it is given, and asks none of lets's own.
    resolvers: {} as Deps['resolvers'],
    io: { ...io, execFile: (cmd, args, opts = {}) => io.execFile(cmd, args, { ...opts, env: { ...process.env, ...settings } }) },
    stdout: (text) => out.push(text),
    stderr: (text) => out.push(text),
  };
  return { deps, output: () => out.join('') };
}

test('the default, lets-delegate-subagent, keeps the shape of the contract', async () => {
  const t = setup();
  assert.equal(await run({ command: [SUBAGENT], live: false }, t.deps), 0, t.output());
  assert.match(t.output(), /The resolver keeps the contract\.\n$/);
});

test('a resolver that breaks the shape fails, one line per check', async () => {
  const t = setup();
  assert.equal(await run({ command: [fixture('fake-resolver')], live: false }, t.deps), 1);
  assert.match(t.output(), /^ok {4}probe answers/m);
  assert.match(t.output(), /^FAIL {2}a request that is not JSON exits 2: it exited 0, not 2$/m);
  assert.match(t.output(), /^FAIL {2}finish with a handle never issued exits 0 or 4 and prints nothing: it printed "\{\}"$/m);
  assert.match(t.output(), /3 check\(s\) failed\.\n$/);
});

test('the live part runs, checks the tree, finishes, and starts', async () => {
  const t = setup();
  await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  assert.match(t.output(), /^ok {4}run answers with text, a known family and resolver$/m);
  assert.match(t.output(), /fake answered as gpt: "FINDINGS"/);
  assert.match(t.output(), /^ok {4}run leaves the tree unchanged$/m);
  assert.match(t.output(), /^ok {4}finish with the run's handle exits 0$/m);
  assert.match(t.output(), /^ok {4}start answers with a handle or instructions, or declines$/m);
  assert.match(t.output(), /it started fake f-1; close it when you are done/);
});

test('a resolver that runs past its deadline fails the check, saying it was stopped', async () => {
  const t = setup();
  const execFile = t.deps.io.execFile;
  t.deps.io = {
    ...t.deps.io,
    execFile: (cmd, args, opts = {}) => (args.at(-1) === 'probe'
      ? Promise.resolve({ stdout: '', stderr: '', code: 1, timedOut: true })
      : execFile(cmd, args, opts)),
  };
  assert.equal(await run({ command: [fixture('fake-resolver')], live: false }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}probe answers.*: it did not exit: no answer in 60 seconds, so it was stopped$/m);
});

test('a probe answer without options fails the probe check, naming options', async () => {
  const t = setup({ FAKE_RESOLVER_STDOUT_PROBE: '{"resolver":"x"}' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: false }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}probe answers.*options/m);
});

test('the probe asks for run', async () => {
  const log = join(mkdtempSync(join(tmpdir(), 'lets-verify-log-')), 'calls');
  const t = setup({ FAKE_RESOLVER_LOG: log });
  await run({ command: [fixture('fake-resolver')], live: false }, t.deps);
  const first = readFileSync(log, 'utf8').split('\n').find((line) => line.startsWith('probe\t'))!;
  assert.equal(JSON.parse(first.split('\t')[1]).verb, 'run');
});

test('the probe for start is checked on its own line', async () => {
  const t = setup();
  await run({ command: [fixture('fake-resolver')], live: false }, t.deps);
  assert.match(t.output(), /^ok {4}probe for start answers \{ resolver, options \} or declines with 75$/m);
});

test('the probe for start sends start as its verb', async () => {
  const log = join(mkdtempSync(join(tmpdir(), 'lets-verify-log-')), 'calls');
  const t = setup({ FAKE_RESOLVER_LOG: log });
  await run({ command: [fixture('fake-resolver')], live: false }, t.deps);
  const verbs = readFileSync(log, 'utf8').split('\n').filter((line) => line.startsWith('probe\t{')).map((line) => JSON.parse(line.split('\t')[1]).verb);
  assert.ok(verbs.includes('start'), verbs.join(' '));
});

test('a probe for start that declines with nothing on stdout passes', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_PROBE_START: '75', FAKE_RESOLVER_STDOUT_PROBE_START: '' });
  await run({ command: [fixture('fake-resolver')], live: false }, t.deps);
  assert.match(t.output(), /^ok {4}probe for start answers/m);
});

test('a probe for start without options fails its check, naming options', async () => {
  const t = setup({ FAKE_RESOLVER_STDOUT_PROBE_START: '{"resolver":"x"}' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: false }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}probe for start answers.*options/m);
  assert.match(t.output(), /^ok {4}probe answers/m);
});

test('a probe for start that declines and prints fails its check', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_PROBE_START: '75' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: false }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}probe for start answers.*: it printed /m);
});

test('the sh example passes the probe for start by declining it', async () => {
  const t = setup();
  assert.equal(await run({ command: [EXAMPLE], live: false }, t.deps), 0, t.output());
  assert.match(t.output(), /^ok {4}probe for start answers/m);
});

test('the default, lets-delegate-subagent, answers the probe for start', async () => {
  const t = setup();
  assert.equal(await run({ command: [SUBAGENT], live: false }, t.deps), 0, t.output());
  assert.match(t.output(), /^ok {4}probe for start answers/m);
});

// The models of the live run requests, in order, with the probe answering options.
async function liveRuns(options: string[], settings: Record<string, string> = {}) {
  const log = join(mkdtempSync(join(tmpdir(), 'lets-verify-log-')), 'calls');
  const t = setup({ FAKE_RESOLVER_LOG: log, FAKE_RESOLVER_STDOUT_PROBE: JSON.stringify({ resolver: 'fake', options }), ...settings });
  const code = await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  const runs = readFileSync(log, 'utf8').split('\n').filter((line) => line.startsWith('run\t')).map((line) => JSON.parse(line.split('\t')[1]).model);
  return { code, runs, output: t.output() };
}

test('the live run sends the first option as its model', async () => {
  const { runs, output } = await liveRuns(['gpt/gpt-6-luna', 'claude']);
  assert.deepEqual(runs, ['gpt/gpt-6-luna']);
  assert.match(output, /^ok {4}run answers with text, a known family and resolver$/m);
});

test('the live run tries the next option when one is refused', async () => {
  const { runs, output } = await liveRuns(['gpt/gpt-6-astra', 'claude'], { FAKE_RESOLVER_REFUSE: 'gpt/gpt-6-astra' });
  assert.deepEqual(runs, ['gpt/gpt-6-astra', 'claude']);
  assert.match(output, /^ok {4}run answers with text, a known family and resolver$/m);
});

test('the live run fails when every option is refused, naming each one', async () => {
  const { code, output } = await liveRuns(['gpt/gpt-6-astra', 'claude'], { FAKE_RESOLVER_REFUSE: 'gpt/gpt-6-astra,claude' });
  assert.equal(code, 1);
  assert.match(output, /^FAIL {2}run answers.*gpt\/gpt-6-astra: refused gpt\/gpt-6-astra.*claude: refused claude/m);
});

test('a resolver with no options gets no live run, and passes', async () => {
  const { runs, output } = await liveRuns([]);
  assert.deepEqual(runs, []);
  assert.match(output, /^ok {4}run answers.*$/m);
  assert.match(output, /lists no model to run/);
});

test('a live run that fails is reported with its reason', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_RUN: '5', FAKE_RESOLVER_STDOUT_RUN: '', FAKE_RESOLVER_STDERR_RUN: 'the session stopped to ask' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: true }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}run answers with text, a known family and resolver: it exited 5, not 0: the session stopped to ask$/m);
});

test('a resolver that declines the live run says where to run the check', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_RUN: '75', FAKE_RESOLVER_STDOUT_RUN: '' });
  await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  assert.match(t.output(), /^FAIL {2}run answers.*: it declined; run the check where this resolver applies$/m);
});

// Fake settings that decline the probe for start, and start, with nothing on stdout.
const DECLINES_START = {
  FAKE_RESOLVER_EXIT_PROBE_START: '75', FAKE_RESOLVER_STDOUT_PROBE_START: '', FAKE_RESOLVER_EXIT_START: '75', FAKE_RESOLVER_STDOUT_START: '',
};

test('the strict fake keeps the contract', async () => {
  const t = setup({ FAKE_RESOLVER_STRICT: '1' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: true }, t.deps), 0, t.output());
});

test('a live start that declines with nothing on stdout passes, and says the next resolver answers handoffs', async () => {
  const t = setup({ FAKE_RESOLVER_STRICT: '1', ...DECLINES_START });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: true }, t.deps), 0, t.output());
  assert.match(t.output(), /^ok {4}start answers with a handle or instructions, or declines$/m);
  assert.match(t.output(), /it declined start; the next resolver in the chain answers handoffs/);
});

test('a live start that declines and prints on stdout fails', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_START: '75', FAKE_RESOLVER_STDOUT_START: '{"resolver":"fake"}' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: true }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}start answers with a handle or instructions, or declines: it printed /m);
});

test('a live start declined after its probe answered fails the probe match', async () => {
  const t = setup({ FAKE_RESOLVER_STRICT: '1', FAKE_RESOLVER_EXIT_START: '75', FAKE_RESOLVER_STDOUT_START: '' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: true }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}a resolver that declines start also declines its probe: /m);
});

test('a resolver that declines start and its probe passes the probe match', async () => {
  const t = setup(DECLINES_START);
  await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  assert.match(t.output(), /^ok {4}a resolver that declines start also declines its probe$/m);
});

test('a resolver that answers start and its probe passes the probe match', async () => {
  const t = setup();
  await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  assert.match(t.output(), /^ok {4}a resolver that declines start also declines its probe$/m);
});

test('the probe match is part of the live check only', async () => {
  const t = setup();
  await run({ command: [fixture('fake-resolver')], live: false }, t.deps);
  assert.doesNotMatch(t.output(), /a resolver that declines start also declines its probe/);
});

// The model of the live start request, with the probes answering as settings say.
async function liveStartModel(settings: Record<string, string>) {
  const log = join(mkdtempSync(join(tmpdir(), 'lets-verify-log-')), 'calls');
  const t = setup({ FAKE_RESOLVER_LOG: log, FAKE_RESOLVER_STDOUT_PROBE_RUN: JSON.stringify({ resolver: 'fake', options: ['gpt/gpt-6-luna'] }), ...settings });
  await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  const start = readFileSync(log, 'utf8').split('\n').find((line) => line.startsWith('start\t'))!;
  return JSON.parse(start.split('\t')[1]).model;
}

test('the live start names the first option from the probe for start', async () => {
  const options = JSON.stringify({ resolver: 'fake', options: ['gemini/gemini-3.8-flash', 'claude'] });
  assert.equal(await liveStartModel({ FAKE_RESOLVER_STDOUT_PROBE_START: options }), 'gemini/gemini-3.8-flash');
});

test('the live start names claude when the probe for start was declined', async () => {
  assert.equal(await liveStartModel({ FAKE_RESOLVER_EXIT_PROBE_START: '75', FAKE_RESOLVER_STDOUT_PROBE_START: '' }), 'claude');
});

test('the live start names claude when the probe for start failed its check', async () => {
  assert.equal(await liveStartModel({ FAKE_RESOLVER_STDOUT_PROBE_START: '{"resolver":"x"}' }), 'claude');
});

test('the live start names claude when the probe for start listed none', async () => {
  assert.equal(await liveStartModel({ FAKE_RESOLVER_STDOUT_PROBE_START: '{"resolver":"fake","options":[]}' }), 'claude');
});

test('arguments after the command go before the verb', async () => {
  const t = setup();
  assert.equal(await run({ command: [process.execPath, SUBAGENT], live: false }, t.deps), 0, t.output());
});
