// The real world, as the adapters see it. Tests pass fakes with the same
// fields instead.
import { execFile as nodeExecFile, spawn } from 'node:child_process';
import { accessSync, chmodSync, closeSync, constants, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function realIo() {
  return {
    // Resolves on any exit code. Rejects only when the command cannot start.
    execFile(cmd, args, { cwd, env, input } = {}) {
      return new Promise((resolve, reject) => {
        const child = nodeExecFile(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error && typeof error.code === 'string') return reject(new Error(`cannot run ${cmd}: ${error.message}`));
          resolve({ stdout, stderr, code: error ? (error.code ?? 1) : 0 });
        });
        // Close stdin even with no input, so a command that reads it does not hang.
        child.stdin.end(input ?? '');
      });
    },

    spawnDetached(cmd, args, { cwd, env, stdoutPath }) {
      const fd = openSync(stdoutPath, 'a');
      const child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', fd, fd] });
      child.unref();
      closeSync(fd);
      return { pid: child.pid };
    },

    commandExists(cmd) {
      return (process.env.PATH ?? '').split(delimiter).some((dir) => {
        try {
          accessSync(join(dir, cmd), constants.X_OK);
          return true;
        } catch {
          return false;
        }
      });
    },

    readFile: (path) => readFileSync(path, 'utf8'),
    exists: (path) => existsSync(path),
    writeFile(path, text, { mode } = {}) {
      writeFileSync(path, text, { mode });
      // mode applies only when the file is created, so set it again.
      if (mode !== undefined) chmodSync(path, mode);
    },
    mkdirp(path, { mode } = {}) {
      mkdirSync(path, { recursive: true });
      if (mode !== undefined) chmodSync(path, mode);
    },
    homedir: () => homedir(),

    pid: process.pid,
    parentPid(pid) {
      try {
        const match = readFileSync(`/proc/${pid}/status`, 'utf8').match(/^PPid:\s+(\d+)$/m);
        return match ? Number(match[1]) : null;
      } catch {
        return null;
      }
    },
    processAlive(pid) {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        // EPERM: the process exists but belongs to another user.
        return error.code === 'EPERM';
      }
    },

    openDb: (path) => new DatabaseSync(path, { readOnly: true }),
    fetch: globalThis.fetch,
    WebSocket: globalThis.WebSocket,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    env: process.env,
  };
}
