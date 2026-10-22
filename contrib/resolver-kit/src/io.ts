// The real world, as the adapters see it. Tests pass fakes with the same
// fields instead.
import { execFile as nodeExecFile } from 'node:child_process';
import { accessSync, chmodSync, constants, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// timedOut: the command ran past timeoutMs, and was stopped.
export type ExecResult = { stdout: string; stderr: string; code: number; timedOut?: boolean };
// input goes to the command's stdin. timeoutMs stops the command when it
// runs longer.
export type ExecOptions = { cwd?: string; env?: Record<string, string | undefined>; input?: string; timeoutMs?: number };

// The part of a node:sqlite database the adapters use.
export type Db = Pick<DatabaseSync, 'prepare' | 'close'>;

export type Io = {
  execFile(cmd: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
  commandExists(cmd: string): boolean;
  readFile(path: string): string;
  exists(path: string): boolean;
  writeFile(path: string, text: string, options?: { mode?: number }): void;
  removeFile(path: string): void;
  mkdirp(path: string, options?: { mode?: number }): void;
  homedir(): string;
  pid: number;
  parentPid(pid: number): number | null;
  processAlive(pid: number): boolean;
  openDb(path: string): Db;
  fetch: typeof globalThis.fetch;
  WebSocket: typeof globalThis.WebSocket;
  now(): number;
  sleep(ms: number): Promise<void>;
  env: Record<string, string | undefined>;
};

export function realIo(): Io {
  return {
    // Resolves on any exit code, and on a timeout. Rejects only when the
    // command cannot start.
    execFile(cmd, args, { cwd, env, input, timeoutMs } = {}) {
      return new Promise((resolve, reject) => {
        let timedOut = false;
        const child = nodeExecFile(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          clearTimeout(timer);
          if (error && typeof error.code === 'string') return reject(new Error(`cannot run ${cmd}: ${error.message}`));
          resolve({ stdout, stderr, code: error ? ((error.code as number | undefined) ?? 1) : 0, timedOut });
        });
        // Do not leave the command running, and spending tokens, after we stop waiting.
        const timer = timeoutMs === undefined ? undefined : setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutMs);
        // Close stdin after the input, so a command that reads it does not hang.
        child.stdin!.on('error', () => {});
        child.stdin!.end(input);
      });
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
    removeFile: (path) => rmSync(path),
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
        return (error as NodeJS.ErrnoException).code === 'EPERM';
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
