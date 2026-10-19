// Copy the release's skills and schema into the project, and say which
// files are out of date.
import { dirname, join } from 'node:path';
import type { Io } from '../io.ts';
import { projectPaths, releasePaths } from './managed.ts';

// The sorted files under a folder, or none when it is not a folder.
function filesUnder(dir: string, io: Io) {
  return io.isDir(dir) && !io.isSymlink(dir) ? io.listFiles(dir) : [];
}

// The first folder between dstDir and the file that is a link or a plain
// file, or null. The source has a folder there, so it must be replaced, and
// nothing may be written through it.
function blockedAncestor(dstDir: string, file: string, io: Io) {
  const parts = file.split('/').slice(0, -1);
  let path = dstDir;
  for (const part of parts) {
    path = join(path, part);
    if (io.isSymlink(path) || (io.exists(path) && !io.isDir(path))) return path;
  }
  return null;
}

// True when a mode has any execute bit. Git tracks only this bit, so it is
// the only part of a mode lets sync compares.
function executable(mode: number) {
  return (mode & 0o111) !== 0;
}

// The mode of a copy: 0755 when the source is executable, else 0644. The
// Nix store is read-only, and a copy must not be.
function copyMode(src: string, io: Io) {
  return executable(io.stat(src).mode) ? 0o755 : 0o644;
}

// True when the project's copy differs from the release's file in bytes or
// in its execute bit, or is a link or a folder.
function differs(src: string, dst: string, io: Io) {
  if (io.isSymlink(dst) || io.isDir(dst)) return true;
  const have = io.readBytes(dst);
  if (have === null || !have.equals(io.readBytes(src)!)) return true;
  return executable(io.stat(dst).mode) !== executable(io.stat(src).mode);
}

// Every file that is wrong under one managed path, as project-relative paths.
function staleFiles({ dst, src }: { dst: string; src: string }, root: string, io: Io) {
  const dstDir = join(root, dst);
  if (io.isSymlink(dstDir) || (io.exists(dstDir) && !io.isDir(dstDir))) return [dst];
  const wanted = filesUnder(src, io);
  const stale = wanted.filter((file) => blockedAncestor(dstDir, file, io) !== null || differs(join(src, file), join(dstDir, file), io));
  const extra = filesUnder(dstDir, io).filter((file) => !wanted.includes(file));
  return [...stale, ...extra].sort().map((file) => `${dst}/${file}`);
}

// Managed project paths that the release does not ship.
function unshipped(paths: { dst: string }[], root: string, io: Io) {
  const shipped = new Set(paths.map((path) => path.dst));
  return projectPaths({ root, io }).filter((path) => !shipped.has(path));
}

// Make the project's managed paths match the release. Returns how many
// files it wrote and which paths it removed. In the ignored mode git
// ignores the copies, so there is nothing to commit.
export function syncSkills({ release, schemaName: _schemaName, root, mode = 'committed', io, stdout }: { release: string; schemaName: string; root: string; mode?: 'committed' | 'ignored'; io: Io; stdout: (text: string) => void }) {
  const paths = releasePaths({ release, io });
  let written = 0;

  for (const { dst, src } of paths) {
    const dstDir = join(root, dst);
    // A link, or a file in a folder's place, is ours by name: replace it.
    if (io.isSymlink(dstDir) || (io.exists(dstDir) && !io.isDir(dstDir))) io.remove(dstDir);

    const wanted = filesUnder(src, io);
    for (const file of wanted) {
      const blocked = blockedAncestor(dstDir, file, io);
      if (blocked !== null) io.remove(blocked);
      const to = join(dstDir, file);
      if (!differs(join(src, file), to, io)) continue;
      // A link or a folder in the file's place is replaced. remove never
      // follows a link.
      if (io.isSymlink(to) || io.isDir(to)) io.remove(to);
      io.mkdirp(dirname(to));
      // An earlier copy may be read-only, as the Nix store is.
      if (io.exists(to)) io.chmod(to, io.stat(to).mode | 0o200);
      io.copyFile(join(src, file), to);
      io.chmod(to, copyMode(join(src, file), io));
      written += 1;
    }
    for (const file of filesUnder(dstDir, io)) {
      if (!wanted.includes(file)) io.remove(join(dstDir, file));
    }
  }

  const removed = unshipped(paths, root, io);
  for (const path of removed) {
    io.remove(join(root, path));
    stdout(`lets-spec: removed ${path}.\n`);
  }
  const next = mode === 'ignored' ? 'Git ignores them.' : 'Commit them.';
  if (written > 0) stdout(`lets-spec: wrote ${written} files. ${next}\n`);
  return { written, removed };
}

// One line per managed file that differs, is missing or is extra.
export function checkSkills({ release, schemaName: _schemaName, root, io }: { release: string; schemaName: string; root: string; io: Io }) {
  const paths = releasePaths({ release, io });
  return [...paths.flatMap((path) => staleFiles(path, root, io)), ...unshipped(paths, root, io)]
    .map((path) => `lets-spec: ${path} is out of date. Run lets sync, then commit it.`);
}
