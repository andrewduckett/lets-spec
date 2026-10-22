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
const SUBAGENT = fileURLToPath(new URL('../../../contrib/subagent-resolver/bin/lets-delegate-subagent', import.meta.url));

// Real deps in a fresh git repo. settings go into the env of each command
// the check runs, for the fake resolver.
function setup(settings: Record<string, string> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'lets-verify-'));
  execFileSync('git', ['init', '--quiet'], { cwd });
  const io = realIo();
  const out: string[] = [];
  const deps: Deps = {
    env: {}, cwd, packageRoot: '/pkg', nodePath: process.execPath,
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

test('a probe answer without options fails the probe check, naming options', async () => {
  const t = setup({ FAKE_RESOLVER_STDOUT_PROBE: '{"resolver":"x"}' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: false }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}probe answers.*options/m);
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

test('a live start that declines with nothing on stdout passes, and says the next resolver answers handoffs', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_START: '75', FAKE_RESOLVER_STDOUT_START: '' });
  await run({ command: [fixture('fake-resolver')], live: true }, t.deps);
  assert.match(t.output(), /^ok {4}start answers with a handle or instructions, or declines$/m);
  assert.match(t.output(), /it declined start; the next resolver in the chain answers handoffs/);
});

test('a live start that declines and prints on stdout fails', async () => {
  const t = setup({ FAKE_RESOLVER_EXIT_START: '75', FAKE_RESOLVER_STDOUT_START: '{"resolver":"fake"}' });
  assert.equal(await run({ command: [fixture('fake-resolver')], live: true }, t.deps), 1);
  assert.match(t.output(), /^FAIL {2}start answers with a handle or instructions, or declines: it printed /m);
});

test('arguments after the command go before the verb', async () => {
  const t = setup();
  assert.equal(await run({ command: [process.execPath, SUBAGENT], live: false }, t.deps), 0, t.output());
});
