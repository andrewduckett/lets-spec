import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('../../../lets/bin/lets', import.meta.url));

// Runs the dev entry and resolves with its output and exit code.
function lets(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((done) => {
    execFile(process.execPath, [ENTRY, ...args], (error, stdout, stderr) => {
      done({ stdout, stderr, code: error ? (error.code as number) : 0 });
    });
  });
}

const REVIEW = ['delegate', 'review', '--name', 'x', '--prompt-file', 'p.md', '--source-family', 'claude', '--effort', 'low'];
const HANDOFF = ['delegate', 'handoff', '--name', 'x', '--prompt-file', 'p.md'];

test('every old command is rejected by name', async () => {
  for (const command of ['critique', 'detect']) {
    const { code, stderr } = await lets('delegate', command);
    assert.equal(code, 2, command);
    assert.match(stderr, new RegExp(`unknown command '${command}'`));
  }
});

test('every old flag is rejected by name', async () => {
  const flags = ['--author', '--source', '--code-review', '--base', '--model', '--unattended', '--timeout', '--prompt'];
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

test('a missing option is a usage error that names it', async () => {
  const { code, stderr } = await lets('delegate', 'review', '--name', 'x');
  assert.equal(code, 2);
  assert.match(stderr, /--prompt-file|--source-family|--effort/);
});

test('review --help lists the exit codes', async () => {
  const { code, stdout } = await lets('delegate', 'review', '--help');
  assert.equal(code, 0);
  assert.match(stdout, /--timeout-minutes/);
  assert.match(stdout, /7 {2}the session changed files outside \.workspace\//);
});

test('review --help says exit 3 means no fresh session can run here', async () => {
  const { stdout } = await lets('delegate', 'review', '--help');
  assert.match(stdout.replace(/\s+/g, ' '),
    /3 no fresh session can run here: no resolver started one, or none of its families is available/);
});

test('neither delegate --help nor review --help says the default runs codex, claude or agy', async () => {
  for (const argv of [['delegate', '--help'], ['delegate', 'review', '--help']]) {
    const { stdout } = await lets(...argv);
    assert.doesNotMatch(stdout, /\b(codex|agy)\b/, argv.join(' '));
    assert.doesNotMatch(stdout, /from another model family when one is available/, argv.join(' '));
  }
});
