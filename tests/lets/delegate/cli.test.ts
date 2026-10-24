import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('../../../lets/bin/lets', import.meta.url));

// Runs the dev entry and resolves with its output and exit code.
function lets(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return letsIn({}, ...args);
}

// Runs the dev entry in a folder, with more in its environment.
function letsIn({ cwd, env = {} }: { cwd?: string; env?: Record<string, string> }, ...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((done) => {
    execFile(process.execPath, [ENTRY, ...args], { cwd, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      done({ stdout, stderr, code: error ? (error.code as number) : 0 });
    });
  });
}

const REVIEW = ['delegate', 'review', 'run', '--for', 'code', '--name', 'x', '--prompt-file', 'p.md', '--source-family', 'claude', '--effort', 'low', '--model', 'gpt'];
const HANDOFF = ['delegate', 'handoff', 'run', '--for', 'apply', '--name', 'x', '--prompt-file', 'p.md', '--model', 'claude'];

test('every old command is rejected by name', async () => {
  for (const command of ['critique', 'detect', 'setup', 'conformance']) {
    const { code, stderr } = await lets('delegate', command);
    assert.equal(code, 2, command);
    assert.match(stderr, new RegExp(`unknown command '${command}'`));
  }
});

test('verify checks a resolver', async () => {
  const resolver = fileURLToPath(new URL('../../../lets/resolvers/headless-resolver', import.meta.url));
  const { code, stdout } = await lets('delegate', 'verify', resolver);
  assert.equal(code, 0);
  assert.equal(stdout.trim().split('\n').at(-1), 'The resolver keeps the contract.');
});

test('every old flag is rejected by name', async () => {
  const flags = ['--author', '--source', '--code-review', '--base', '--unattended', '--timeout', '--prompt'];
  const runs = flags.flatMap((flag) => [REVIEW, HANDOFF].map(async (argv) => {
    const { code, stderr } = await lets(...argv, flag, 'v');
    assert.equal(code, 2, `${argv[1]} ${flag}`);
    assert.match(stderr, new RegExp(`unknown option '${flag}'`), `${argv[1]} ${flag}`);
  }));
  await Promise.all(runs);
});

test('a bad family, effort or timeout is a usage error that names it', async () => {
  const cases: [string[], RegExp][] = [
    [['--source-family', 'openai'], /openai/],
    [['--effort', 'max'], /max/],
    [['--timeout-minutes', 'soon'], /whole number of minutes/],
  ];
  await Promise.all(cases.map(async ([extra, message]) => {
    const { code, stderr } = await lets(...REVIEW, ...extra);
    assert.equal(code, 2, extra.join(' '));
    assert.match(stderr, message);
  }));
});

test('each run without --model is a usage error that names it', async () => {
  for (const argv of [REVIEW, HANDOFF]) {
    const { code, stderr } = await lets(...argv.slice(0, -2));
    assert.equal(code, 2, argv[1]);
    assert.match(stderr, /--model/, argv[1]);
  }
});

test('a --model that is not <family> or <family>/<model> is a usage error that names it', async () => {
  for (const argv of [REVIEW, HANDOFF]) {
    for (const model of ['llama/llama-4', 'gpt/', 'GPT']) {
      const { code, stderr } = await lets(...argv.slice(0, -2), '--model', model);
      assert.equal(code, 2, `${argv[1]} ${model}`);
      assert.match(stderr, /--model/, `${argv[1]} ${model}`);
    }
  }
});

test('a missing option is a usage error that names it', async () => {
  const { code, stderr } = await lets('delegate', 'review', 'run', '--for', 'code', '--name', 'x');
  assert.equal(code, 2);
  assert.match(stderr, /--prompt-file|--source-family|--effort/);
});

test('review run --help lists the exit codes', async () => {
  const { code, stdout } = await lets('delegate', 'review', 'run', '--help');
  assert.equal(code, 0);
  assert.match(stdout, /--timeout-minutes/);
  assert.match(stdout, /7 {2}the session changed files outside \.workspace\//);
});

test('each run --help names --model, and says exit 3 is every model refused and exit 4 an unknown outcome', async () => {
  for (const argv of [['delegate', 'review', 'run', '--help'], ['delegate', 'handoff', 'run', '--help']]) {
    const text = (await lets(...argv)).stdout.replace(/\s+/g, ' ');
    assert.match(text, /--model <family\[\/model\]>/, argv.join(' '));
    assert.match(text, /3 no fresh session can run here on any model given: the harness or the account said no/, argv.join(' '));
    assert.match(text, /4 the resolver broke the contract, or the outcome is unknown/, argv.join(' '));
  }
});

test('neither delegate --help nor review --help says the default runs codex, claude or agy', async () => {
  for (const argv of [['delegate', '--help'], ['delegate', 'review', 'run', '--help']]) {
    const { stdout } = await lets(...argv);
    assert.doesNotMatch(stdout, /\b(codex|agy)\b/, argv.join(' '));
    assert.doesNotMatch(stdout, /from another model family when one is available/, argv.join(' '));
  }
});

test('delegate --help describes the chain in config.yaml, and names neither setup nor a PATH lookup', async () => {
  const { stdout } = await lets('delegate', '--help');
  const text = stdout.replace(/\s+/g, ' ');
  assert.match(text, /config\.yaml/);
  assert.match(text, /resolvers/);
  assert.match(text, /\bsubagent\b/);
  assert.doesNotMatch(text, /setup/);
  assert.doesNotMatch(text, /lets-delegate-resolver/);
});

test('each run and instructions --help says exit 2 covers every resolver in the config declining', async () => {
  for (const argv of [['delegate', 'review', 'run', '--help'], ['delegate', 'handoff', 'run', '--help'],
    ['delegate', 'review', 'instructions', '--help'], ['delegate', 'handoff', 'instructions', '--help']]) {
    const { stdout } = await lets(...argv);
    assert.match(stdout.replace(/\s+/g, ' '), /2 usage error, or every resolver in the config declined/, argv.join(' '));
  }
});

const FAKE = fileURLToPath(new URL('fixtures/fake-resolver', import.meta.url));

// A git repo with a prompt file, the fake resolver as LETS_SPEC_RESOLVER
// logging its calls, and an empty config folder. calls() lists the verb and
// request of each call it took.
function repo(settings: Record<string, string> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'lets-cli-'));
  execFileSync('git', ['init', '--quiet'], { cwd });
  writeFileSync(join(cwd, 'p.md'), 'PROMPT');
  const log = join(cwd, '.git', 'calls');
  const env = { LETS_SPEC_RESOLVER: FAKE, FAKE_RESOLVER_LOG: log, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'lets-cfg-')), ...settings };
  const calls = (): [string, Record<string, unknown>][] => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [])
    .map((line) => { const [verb, request] = line.split('\t'); return [verb, JSON.parse(request)]; });
  return { cwd, env, calls };
}

test('review --help names instructions and run', async () => {
  const { code, stdout } = await lets('delegate', 'review', '--help');
  assert.equal(code, 0);
  assert.match(stdout, /^ {2}instructions\b/m);
  assert.match(stdout, /^ {2}run\b/m);
});

test('handoff --help names instructions and run', async () => {
  const { stdout } = await lets('delegate', 'handoff', '--help');
  assert.match(stdout, /^ {2}instructions\b/m);
  assert.match(stdout, /^ {2}run\b/m);
});

test('review run records its --for first in the metadata line on stderr', async () => {
  const r = repo();
  const { code, stderr } = await letsIn(r, 'delegate', 'review', 'run', '--for', 'plan', '--name', 'x', '--prompt-file', 'p.md',
    '--source-family', 'claude', '--effort', 'low', '--model', 'gpt');
  assert.equal(code, 0, stderr);
  const line = stderr.trim().split('\n').at(-1)!;
  assert.ok(line.startsWith('{"for":"plan",'), line);
  assert.deepEqual(Object.keys(JSON.parse(line)), ['for', 'resolver', 'family', 'model', 'independent', 'handle', 'gitClean', 'durationSeconds']);
});

test('handoff run prints the resolver\'s response unchanged, without for', async () => {
  const r = repo();
  const { code, stdout } = await letsIn(r, 'delegate', 'handoff', 'run', '--for', 'apply', '--name', 'build-x', '--prompt-file', 'p.md', '--model', 'claude');
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).for, undefined);
});

test('a run without --for is a usage error that names it, and asks no resolver', async () => {
  const r = repo();
  const { code, stderr } = await letsIn(r, 'delegate', 'handoff', 'run', '--name', 'build-x', '--prompt-file', 'p.md', '--model', 'claude');
  assert.equal(code, 2);
  assert.match(stderr, /--for/);
  assert.deepEqual(r.calls(), []);
});

test('an intent from the other strategy is a usage error that names --for, and asks no resolver', async () => {
  const r = repo();
  const { code, stderr } = await letsIn(r, 'delegate', 'review', 'instructions', '--for', 'apply');
  assert.equal(code, 2);
  assert.match(stderr, /--for/);
  assert.deepEqual(r.calls(), []);
});

test('handoff run --for apply sends a start request', async () => {
  const r = repo();
  const { code } = await letsIn(r, 'delegate', 'handoff', 'run', '--for', 'apply', '--name', 'build-x', '--prompt-file', 'p.md', '--model', 'claude');
  assert.equal(code, 0);
  assert.deepEqual(r.calls().map(([verb]) => verb), ['start']);
});

test('run takes --model more than once, in order', async () => {
  const r = repo({ FAKE_RESOLVER_REFUSE: 'gpt/gpt-6-astra' });
  const { code } = await letsIn(r, ...REVIEW.slice(0, -2), '--model', 'gpt/gpt-6-astra', '--model', 'gemini');
  assert.equal(code, 0);
  assert.deepEqual(r.calls().filter(([verb]) => verb === 'run').map(([, request]) => request.model), ['gpt/gpt-6-astra', 'gemini']);
});

test('review instructions --for plan prints one JSON line', async () => {
  const r = repo();
  const { code, stdout } = await letsIn(r, 'delegate', 'review', 'instructions', '--for', 'plan');
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), { strategy: 'review', for: 'plan', resolver: 'fake', options: ['gpt/fake-model'], guidance: null });
});

test('handoff instructions pass over the sh example to subagent', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'lets-cli-'));
  execFileSync('git', ['init', '--quiet'], { cwd });
  const config = mkdtempSync(join(tmpdir(), 'lets-cfg-'));
  const example = fileURLToPath(new URL('../../../lets/resolvers/headless-resolver', import.meta.url));
  mkdirSync(join(config, 'lets-delegate'));
  writeFileSync(join(config, 'lets-delegate', 'config.yaml'), `version: 2\nresolvers:\n  - ${example}\n  - subagent\n`);
  const { code, stdout } = await letsIn({ cwd, env: { XDG_CONFIG_HOME: config, LETS_SPEC_RESOLVER: '' } }, 'delegate', 'handoff', 'instructions', '--for', 'apply');
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).resolver, 'subagent');
});

test('each strategy\'s --help names its intents', async () => {
  const cases: [string[], RegExp][] = [
    [['delegate', 'review', 'run', '--help'], /choices: "plan", "code"/],
    [['delegate', 'review', 'instructions', '--help'], /choices: "plan", "code"/],
    [['delegate', 'handoff', 'run', '--help'], /choices: "apply"/],
    [['delegate', 'handoff', 'instructions', '--help'], /choices: "apply"/],
  ];
  for (const [argv, intents] of cases) {
    assert.match((await lets(...argv)).stdout.replace(/\s+/g, ' '), intents, argv.join(' '));
  }
});

test('instructions --help names its output and exit codes', async () => {
  const text = (await lets('delegate', 'review', 'instructions', '--help')).stdout.replace(/\s+/g, ' ');
  assert.match(text, /strategy, for, resolver, options and guidance/);
  assert.match(text, /delegations\.<intent>\.guidance/);
});
