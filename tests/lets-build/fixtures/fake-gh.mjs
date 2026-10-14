// Stand-ins for gh. fakeGh runs in process, for the tests of run(), and
// spawnEntry runs the real entry with the fake gh executable from
// tests/support/fake-gh first on PATH. Both log each call as an array of
// arguments, so a test can tell one argument from two.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fakeGhDir = join(repoRoot, 'tests/support/fake-gh');

// gh's answer when the API has no such thing.
export const NOT_FOUND = { stdout: '', stderr: 'gh: Not Found (HTTP 404)\n', code: 1 };

// A fake execFile for gh. answer(args) gets the argument array and returns
// a string (stdout, code 0), a { stdout, stderr, code }, or undefined
// (empty stdout, code 0). calls holds each call's arguments, in order.
export function fakeGh(answer = () => undefined) {
  const calls = [];
  async function execFile(cmd, args) {
    if (cmd !== 'gh') throw new Error(`the fake runs only gh, not ${cmd}`);
    calls.push([...args]);
    const reply = answer(args);
    if (reply === undefined) return { stdout: '', stderr: '', code: 0 };
    if (typeof reply === 'string') return { stdout: reply, stderr: '', code: 0 };
    return { stdout: '', stderr: '', code: 0, ...reply };
  }
  return { calls, execFile };
}

// Run run(argv, deps), and collect what it writes to stdout and stderr.
export async function runWith(run, argv, deps) {
  let stdout = '';
  let stderr = '';
  const code = await run(argv, {
    ...deps,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  });
  return { code, stdout, stderr };
}

// Spawn `node <entry> ...argv` from the repo root, with the fake gh first on
// PATH. answers is the list the fake gh answers from: [{ args, stdout?,
// stderr?, code? }]. Returns the exit status, stdout, stderr, and the
// logged calls as arrays.
export function spawnEntry(entry, argv, answers = []) {
  const dir = mkdtempSync(join(tmpdir(), 'entry-'));
  try {
    const log = join(dir, 'gh.log');
    const answersFile = join(dir, 'answers.json');
    writeFileSync(log, '');
    writeFileSync(answersFile, JSON.stringify(answers));
    const result = spawnSync(process.execPath, [join(repoRoot, entry), ...argv], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeGhDir}:${process.env.PATH}`,
        FAKE_GH_LOG: log,
        FAKE_GH_ANSWERS: answersFile,
      },
    });
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, log: calls };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
