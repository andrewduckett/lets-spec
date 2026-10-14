// The real filesystem, git and child processes, as the modules see them.
// Tests pass a fake with the same methods.
import { execFile as nodeExecFile } from 'node:child_process';
import {
  chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  readlinkSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

// Run fn, and answer null when the path does not exist.
function orNull(fn) {
  try {
    return fn();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EINVAL') return null;
    throw error;
  }
}

// Every file under dir, as a path relative to dir.
function walk(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(dir, rel));
    else found.push(rel);
  }
  return found;
}

export function realIo() {
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
    execFile(cmd, args, { cwd } = {}) {
      return new Promise((resolve) => {
        const child = nodeExecFile(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error && typeof error.code === 'string') return resolve({ stdout: '', stderr: error.message, code: null });
          resolve({ stdout, stderr, code: error ? (error.code ?? 1) : 0 });
        });
        child.stdin.on('error', () => {});
        child.stdin.end();
      });
    },
  };
}
