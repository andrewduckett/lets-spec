import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  for (const command of ['critique', 'detect', 'setup', 'conformance', 'verify']) {
    const { code, stderr } = await lets('delegate', command);
    assert.equal(code, 2, command);
    assert.match(stderr, new RegExp(`unknown command '${command}'`));
  }
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
    assert.match(text, /4 the outcome is unknown/, argv.join(' '));
    assert.doesNotMatch(text, /broke the contract/, argv.join(' '));
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

test('delegate --help lists the resolvers by name, not by path', async () => {
  const text = (await lets('delegate', '--help')).stdout.replace(/\s+/g, ' ');
  assert.match(text, /- t3 - subagent/);
  assert.match(text, /t3, cli or subagent/);
  assert.doesNotMatch(text, /absolute path|\/absolute/);
});

test('instructions --help says exit 4 is an unknown outcome', async () => {
  const text = (await lets('delegate', 'review', 'instructions', '--help')).stdout.replace(/\s+/g, ' ');
  assert.match(text, /4 the outcome is unknown/);
  assert.doesNotMatch(text, /broke the contract/);
});

test('each run and instructions --help says exit 2 covers every resolver in the config declining', async () => {
  for (const argv of [['delegate', 'review', 'run', '--help'], ['delegate', 'handoff', 'run', '--help'],
    ['delegate', 'review', 'instructions', '--help'], ['delegate', 'handoff', 'instructions', '--help']]) {
    const { stdout } = await lets(...argv);
    assert.match(stdout.replace(/\s+/g, ' '), /2 usage error, or every resolver in the config declined/, argv.join(' '));
  }
});

// A git repo with a prompt file, and an empty config folder, so the
// default, subagent, answers. config, when given, is the delegate config.
function repo(config?: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'lets-cli-'));
  execFileSync('git', ['init', '--quiet'], { cwd });
  writeFileSync(join(cwd, 'p.md'), 'PROMPT');
  const home = mkdtempSync(join(tmpdir(), 'lets-cfg-'));
  if (config !== undefined) {
    mkdirSync(join(home, 'lets'));
    writeFileSync(join(home, 'lets', 'config.yaml'), config);
  }
  return { cwd, env: { XDG_CONFIG_HOME: home } };
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

test('with no config, handoff run answers with subagent and saves the prompt', async () => {
  const r = repo();
  const { code, stdout } = await letsIn(r, ...HANDOFF.slice(0, 6), 'build-x', ...HANDOFF.slice(7));
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).resolver, 'subagent');
  assert.equal(readFileSync(join(r.cwd, '.workspace/lets-delegate/build-x.prompt.md'), 'utf8'), 'PROMPT');
});

test('with no config, review instructions --for plan prints one JSON line from subagent', async () => {
  const { code, stdout } = await letsIn(repo(), 'delegate', 'review', 'instructions', '--for', 'plan');
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), { strategy: 'review', for: 'plan', resolver: 'subagent', options: [], guidance: null });
});

test('run takes --model more than once, in order', async () => {
  const { code, stderr } = await letsIn(repo(), ...REVIEW.slice(0, -2), '--model', 'gpt/gpt-6-astra', '--model', 'gemini');
  assert.equal(code, 3);
  assert.match(stderr, /gpt\/gpt-6-astra: .*\ngemini: /);
});

test('a run without --for is a usage error that names it', async () => {
  const { code, stdout, stderr } = await letsIn(repo(), 'delegate', 'handoff', 'run', '--name', 'build-x', '--prompt-file', 'p.md', '--model', 'claude');
  assert.equal(code, 2);
  assert.equal(stdout, '');
  assert.match(stderr, /--for/);
});

test('an intent from the other strategy is a usage error that names --for', async () => {
  const { code, stdout, stderr } = await letsIn(repo(), 'delegate', 'review', 'instructions', '--for', 'apply');
  assert.equal(code, 2);
  assert.equal(stdout, '');
  assert.match(stderr, /--for/);
});

test('a resolver listed by path is exit 2, naming it and the config file', async () => {
  const example = '/opt/r/old-resolver';
  const r = repo(`version: 3\ndelegate:\n  resolvers:\n    - ${example}\n    - subagent\n`);
  const { code, stdout, stderr } = await letsIn(r, 'delegate', 'handoff', 'instructions', '--for', 'apply');
  assert.equal(code, 2);
  assert.equal(stdout, '');
  assert.ok(stderr.includes(example), stderr);
  assert.ok(stderr.includes(join(r.env.XDG_CONFIG_HOME, 'lets', 'config.yaml')), stderr);
});

test('a name lets does not know is exit 2, naming it and the three names', async () => {
  const { code, stdout, stderr } = await letsIn(repo('version: 3\ndelegate: { resolvers: [codex] }\n'), ...HANDOFF);
  assert.equal(code, 2);
  assert.equal(stdout, '');
  assert.match(stderr, /codex/);
  assert.match(stderr, /t3, cli or subagent/);
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
