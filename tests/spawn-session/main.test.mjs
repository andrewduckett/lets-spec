import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../../skills/spawn-session/scripts/lib/main.mjs';
import { ReviewerFailed, SpawnError, TimeoutError } from '../../skills/spawn-session/scripts/lib/errors.mjs';
import { fakeAdapter } from './fixtures/fake-adapter.mjs';

const ENTRY = fileURLToPath(new URL('../../skills/spawn-session/scripts/spawn-session.mjs', import.meta.url));

// Runs a command and resolves with its output and exit code, even on failure.
function execFileP(cmd, args, options = {}) {
  return new Promise((done) => {
    execFile(cmd, args, options, (error, stdout, stderr) => done({ stdout, stderr, code: error ? error.code : 0 }));
  });
}

const ALL = { gpt: [null], claude: [null], gemini: [null] };

// A none adapter that detects, a clean tree, and captured output.
// adapters: overrides for t3, herdr and none; the rest: overrides for deps.
// gitStatus: what `git status -z` prints after the review; gitBefore: before it.
function makeDeps({ adapters = {}, gitStatus = '', gitBefore = gitStatus, ...overrides } = {}) {
  let statusCalls = 0;
  const out = [];
  const err = [];
  const deps = {
    env: {},
    cwd: '/repo',
    adapters: {
      t3: fakeAdapter('t3'),
      herdr: fakeAdapter('herdr'),
      none: fakeAdapter('none', { detects: true, available: ALL }),
      ...adapters,
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    readFile: (path) => { assert.equal(path, '/repo/p.md'); return 'PROMPT TEXT'; },
    execFile: async () => ({ stdout: statusCalls++ === 0 ? gitBefore : gitStatus, stderr: '', code: 0 }),
    now: () => 0,
    sleep: async () => {},
    ...overrides,
  };
  return { deps, out, err, calls: (name) => deps.adapters[name].calls };
}

const critique = (...extra) => ['critique', '--name', 'x-plan-review', '--author', 'claude', '--effort', 'high', '--prompt-file', 'p.md', ...extra];
const callsOf = (calls, kind) => calls.filter(([k]) => k === kind);

test('detect prints the harness', async () => {
  const a = makeDeps();
  assert.equal(await run(['detect'], a.deps), 0);
  assert.deepEqual(a.out, ['none\n']);
  const b = makeDeps({ env: { LETS_SPEC_HARNESS: 't3' } });
  assert.equal(await run(['detect'], b.deps), 0);
  assert.deepEqual(b.out, ['t3\n']);
});

test('critique happy path prints the findings and one JSON line', async () => {
  const { deps, out, err, calls } = makeDeps();
  assert.equal(await run(critique(), deps), 0);
  assert.equal(out.join(''), 'FINDINGS\n');
  const meta = JSON.parse(err.join(''));
  assert.equal(meta.harness, 'none');
  assert.equal(meta.family, 'gpt');
  assert.equal(meta.independent, true);
  assert.equal(meta.threadId, 'thread-1');
  assert.equal(meta.gitClean, true);
  const [[, request]] = callsOf(calls('none'), 'spawn');
  assert.equal(request.readOnly, true);
  assert.equal(request.attended, false);
  assert.equal(request.kind, 'critique');
  assert.equal(request.prompt, 'PROMPT TEXT');
  assert.deepEqual(callsOf(calls('none'), 'finish').map(([, , ok]) => ok), [true]);
});

test('a code review by claude in t3 sends the built-in command', async () => {
  const t3 = fakeAdapter('t3', { detects: true, available: { gpt: [], claude: ['claude-fable-5-1'], gemini: [] } });
  const { deps, calls } = makeDeps({ adapters: { t3 } });
  const argv = ['critique', '--name', 'b-code-review', '--author', 'gpt', '--effort', 'high', '--code-review', '--base', 'main'];
  assert.equal(await run(argv, deps), 0);
  const [[, request]] = callsOf(calls('t3'), 'spawn');
  assert.equal(request.prompt, '/code-review high main...HEAD');
  assert.deepEqual(request.codeReview, { base: 'main' });
});

test('no reviewer available exits 3 and spawns nothing', async () => {
  const none = fakeAdapter('none', { detects: true });
  const { deps, err, calls } = makeDeps({ adapters: { none } });
  assert.equal(await run(critique(), deps), 3);
  assert.match(err.join(''), /author of claude/);
  assert.equal(callsOf(calls('none'), 'spawn').length, 0);
});

test('a reviewer failure exits 5 and leaves the thread', async () => {
  const none = fakeAdapter('none', { detects: true, available: ALL, waitError: new ReviewerFailed('asked a question') });
  const { deps, err, calls } = makeDeps({ adapters: { none } });
  assert.equal(await run(critique(), deps), 5);
  assert.match(err.join(''), /asked a question/);
  assert.match(err.join(''), /\(fake thread-1\)/);
  assert.deepEqual(callsOf(calls('none'), 'finish').map(([, , ok]) => ok), [false]);
});

test('a timeout exits 6 after waiting the effort\'s default', async () => {
  const none = fakeAdapter('none', { detects: true, available: ALL, waitError: new TimeoutError('late') });
  const { deps, calls } = makeDeps({ adapters: { none } });
  assert.equal(await run(critique(), deps), 6);
  const [[, , options]] = callsOf(calls('none'), 'wait');
  assert.equal(options.timeoutMs, 45 * 60000);
  assert.deepEqual(callsOf(calls('none'), 'finish').map(([, , ok]) => ok), [false]);
});

test('a dirty tree exits 7 and prints no findings', async () => {
  const { deps, out, calls } = makeDeps({ gitStatus: ' M src/a.js\0', gitBefore: '' });
  assert.equal(await run(critique(), deps), 7);
  assert.deepEqual(out, []);
  assert.deepEqual(callsOf(calls('none'), 'finish').map(([, , ok]) => ok), [false]);
});

test('files the user had already changed do not count as the reviewer\'s', async () => {
  const { deps, out } = makeDeps({ gitStatus: ' M src/a.js\0?? .envrc\0' });
  assert.equal(await run(critique(), deps), 0);
  assert.equal(out.join(''), 'FINDINGS\n');
});

test('an empty final message is a reviewer failure', async () => {
  const none = fakeAdapter('none', { detects: true, available: ALL, result: '  \n' });
  const { deps, err } = makeDeps({ adapters: { none } });
  assert.equal(await run(critique(), deps), 5);
  assert.match(err.join(''), /empty final message/);
});

test('handoff prints the harness and thread, attended by default', async () => {
  const { deps, out, calls } = makeDeps();
  assert.equal(await run(['handoff', '--name', 'fix-login', '--prompt', 'Run lets-build on branch fix-login'], deps), 0);
  assert.deepEqual(out, ['{"harness":"none","threadId":"thread-1"}\n']);
  const [[, request]] = callsOf(calls('none'), 'spawn');
  assert.equal(request.attended, true);
  assert.equal(request.kind, 'handoff');
  assert.equal(request.model, null);
});

test('handoff --unattended and --model reach the adapter', async () => {
  const { deps, calls } = makeDeps();
  assert.equal(await run(['handoff', '--name', 'a', '--prompt', 'p', '--unattended', '--model', 'claude-sonnet-5-5'], deps), 0);
  const [[, request]] = callsOf(calls('none'), 'spawn');
  assert.equal(request.attended, false);
  assert.equal(request.model, 'claude-sonnet-5-5');
});

test('a spawn error on handoff exits 4', async () => {
  const none = fakeAdapter('none', { detects: true, spawnError: new SpawnError('no terminal') });
  const { deps, err } = makeDeps({ adapters: { none } });
  assert.equal(await run(['handoff', '--name', 'a', '--prompt', 'p'], deps), 4);
  assert.match(err.join(''), /no terminal/);
});

test('--help prints usage; a bad flag exits 2 and names it', async () => {
  const a = makeDeps();
  assert.equal(await run(['--help'], a.deps), 0);
  assert.match(a.out.join(''), /^usage:/);
  const b = makeDeps();
  assert.equal(await run(['detect', '--bogus'], b.deps), 2);
  assert.match(b.err.join(''), /--bogus/);
});

test('the entry point prints usage on --help and on a bad flag', async () => {
  const help = await execFileP('node', [ENTRY, '--help']);
  assert.equal(help.code, 0); assert.match(help.stdout, /^usage: spawn-session/);
  const bad = await execFileP('node', [ENTRY, 'detect', '--bogus']);
  assert.equal(bad.code, 2); assert.match(bad.stderr, /--bogus/);
});
test('the entry point detects none outside any harness', async () => {
  const { stdout, code } = await execFileP('node', [ENTRY, 'detect'], { env: { PATH: process.env.PATH, HOME: process.env.HOME, LETS_SPEC_HARNESS: 'none' } });
  assert.equal(code, 0); assert.equal(stdout, 'none\n');
});

test('a missing prompt file is a usage error that names the path', async () => {
  const { deps, err, calls } = makeDeps({ readFile: (path) => { throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: 'ENOENT' }); } });
  assert.equal(await run(critique(), deps), 2);
  assert.match(err.join(''), /p\.md/);
  assert.equal(callsOf(calls('none'), 'spawn').length, 0);
});
