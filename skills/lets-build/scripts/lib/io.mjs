// The real child processes, as main.mjs sees them. Tests pass a fake with
// the same contract.
import { execFile as nodeExecFile } from 'node:child_process';

// Resolves on any exit code. code is null when the command cannot start,
// and stderr then holds the reason.
export function execFile(cmd, args, { cwd } = {}) {
  return new Promise((resolve) => {
    const child = nodeExecFile(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && typeof error.code === 'string') return resolve({ stdout: '', stderr: error.message, code: null });
      resolve({ stdout, stderr, code: error ? (error.code ?? 1) : 0 });
    });
    child.stdin.on('error', () => {});
    child.stdin.end();
  });
}
