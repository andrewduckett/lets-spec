// The real filesystem, git and child processes, as the modules see them.
// Tests pass a fake with the same methods.
import { execFile as nodeExecFile } from 'node:child_process';
import {
  accessSync, chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  readlinkSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { delimiter, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

// What a command printed, and its exit code. code is null when the command
// cannot start.
export type ExecResult = { stdout: string; stderr: string; code: number | null };

// The running command, for a caller that may need to kill it.
export type Child = { pid?: number; kill(): void };

// env replaces the whole environment. input is written to stdin, which is
// closed either way. started receives the child as soon as it exists.
export type ExecOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  input?: string;
  started?: (child: Child) => void;
};

export type Io = {
  readFile(path: string): string | null;
  readBytes(path: string): Buffer | null;
  writeFile(path: string, text: string): void;
  exists(path: string): boolean;
  isSymlink(path: string): boolean;
  isDir(path: string): boolean;
  readlink(path: string): string | null;
  symlink(target: string, path: string): void;
  remove(path: string): void;
  mkdirp(path: string): void;
  stat(path: string): { mode: number };
  chmod(path: string, mode: number): void;
  copyFile(src: string, dst: string): void;
  listDirs(path: string): string[];
  listNames(path: string): string[];
  listFiles(path: string): string[];
  execFile(cmd: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
  commandExists(cmd: string): boolean;
  now(): number;
  // Rejects when signal aborts, so a caller can cancel a long wait.
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
};

// Everything a command needs from the real world.
export type Deps = {
  env: Record<string, string | undefined>;
  cwd: string;
  packageRoot: string;
  io: Io;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

// Run fn, and answer null when the path does not exist.
function orNull<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EINVAL') return null;
    throw error;
  }
}

// Every file under dir, as a path relative to dir.
function walk(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(dir, rel));
    else found.push(rel);
  }
  return found;
}

export function realIo(): Io {
  return {
    readFile: (path) => orNull(() => readFileSync(path, 'utf8')),
    readBytes: (path) => orNull(() => readFileSync(path)),
    // Writes through an existing file, so its inode, links and mode are kept.
    writeFile: (path, text) => writeFileSync(path, text),
    exists: (path) => existsSync(path),
    isSymlink: (path) => orNull(() => lstatSync(path).isSymbolicLink()) ?? false,
    isDir: (path) => orNull(() => statSync(path).isDirectory()) ?? false,
    readlink: (path) => orNull(() => readlinkSync(path)),
    symlink: (target, path) => symlinkSync(target, path),
    remove: (path) => rmSync(path, { recursive: true, force: true }),
    mkdirp: (path) => mkdirSync(path, { recursive: true }),
    stat: (path) => ({ mode: statSync(path).mode & 0o7777 }),
    chmod: (path, mode) => chmodSync(path, mode),
    // Keeps the source's mode, even when the source is read-only.
    copyFile(src, dst) {
      copyFileSync(src, dst);
      chmodSync(dst, statSync(src).mode & 0o7777);
    },
    listDirs: (path) => readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    // Every entry name: files, folders and links, even a link that dangles.
    listNames: (path) => (orNull(() => readdirSync(path)) ?? []).sort(),
    listFiles: (path) => walk(path).sort(),

    // Resolves on any exit code. code is null when the command cannot start.
    execFile(cmd, args, { cwd, env, input, started } = {}) {
      return new Promise((resolve) => {
        const child = nodeExecFile(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error && typeof error.code === 'string') return resolve({ stdout: '', stderr: error.message, code: null });
          resolve({ stdout, stderr, code: error ? ((error.code as number | undefined) ?? 1) : 0 });
        });
        started?.(child);
        // A command may exit without reading its input. Its exit code says
        // what happened, so a broken pipe here is not an error.
        child.stdin!.on('error', () => {});
        child.stdin!.end(input);
      });
    },

    commandExists: (cmd) => (process.env.PATH ?? '').split(delimiter).some((dir) => {
      try {
        accessSync(join(dir, cmd), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }),
    now: () => Date.now(),
    sleep: (ms, signal) => setTimeout(ms, undefined, { signal }),
  };
}
