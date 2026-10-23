// An in-memory tree with the same methods as the Io in lets/src/io.ts. Paths
// are absolute.
//
// options:
//   files:    { path: text }
//   dirs:     paths that are folders even when empty
//   toplevel: what `git rev-parse --show-toplevel` answers; without it git
//             fails with code 128.
//   openspec: what `openspec --version` prints; without it the command
//             cannot start (code null).
import type { Io } from '../../../../lets/src/io.ts';

export type FakeIo = Io & {
  files: Map<string, string>;
  dirs: Set<string>;
  links: Map<string, string>;
  modes: Map<string, number>;
  calls: [string, string[], { cwd?: string }][];
  toplevel: string | null;
};

type Options = { files?: Record<string, string>; dirs?: string[]; toplevel?: string | null; openspec?: string | null };

export function fakeIo({ files = {}, dirs = [], toplevel = null, openspec = null }: Options = {}): FakeIo {
  const io: FakeIo = {
    files: new Map(Object.entries(files)),
    dirs: new Set(dirs),
    links: new Map(),
    modes: new Map(),
    calls: [],
    toplevel,

    readFile: (path) => io.files.get(path) ?? null,
    readBytes: (path) => (io.files.has(path) ? Buffer.from(io.files.get(path)!) : null),
    writeFile(path, text) {
      io.files.set(path, text);
      if (!io.modes.has(path)) io.modes.set(path, 0o644);
    },
    exists: (path) => io.files.has(path) || io.isDir(path) || io.links.has(path),
    isSymlink: (path) => io.links.has(path),
    isDir(path) {
      if (io.dirs.has(path)) return true;
      const prefix = `${path}/`;
      return [...io.files.keys(), ...io.dirs, ...io.links.keys()].some((p) => p.startsWith(prefix));
    },
    readlink: (path) => io.links.get(path) ?? null,
    symlink: (target, path) => io.links.set(path, target),
    remove(path) {
      const prefix = `${path}/`;
      for (const map of [io.files, io.links, io.modes]) {
        for (const key of [...map.keys()]) if (key === path || key.startsWith(prefix)) map.delete(key);
      }
      for (const dir of [...io.dirs]) if (dir === path || dir.startsWith(prefix)) io.dirs.delete(dir);
    },
    mkdirp: (path) => io.dirs.add(path),
    stat: (path) => ({ mode: io.modes.get(path) ?? 0o644 }),
    chmod: (path, mode) => io.modes.set(path, mode),
    copyFile(src, dst) {
      io.files.set(dst, io.files.get(src)!);
      io.modes.set(dst, io.modes.get(src) ?? 0o644);
    },
    listDirs(path) {
      const prefix = `${path}/`;
      const names = new Set<string>();
      for (const p of [...io.files.keys(), ...io.dirs, ...io.links.keys()]) {
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash > 0 || io.dirs.has(p)) names.add(slash > 0 ? rest.slice(0, slash) : rest);
      }
      return [...names].sort();
    },
    listNames(path) {
      const prefix = `${path}/`;
      const names = new Set<string>();
      for (const p of [...io.files.keys(), ...io.dirs, ...io.links.keys()]) {
        if (p.startsWith(prefix)) names.add(p.slice(prefix.length).split('/')[0]);
      }
      return [...names].sort();
    },
    listFiles(path) {
      const prefix = `${path}/`;
      return [...io.files.keys()].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length)).sort();
    },
    async execFile(cmd, args, opts = {}) {
      io.calls.push([cmd, args, opts]);
      const key = `${cmd} ${args.join(' ')}`;
      if (cmd === 'git' && io.toplevel !== null) {
        if (key === 'git rev-parse --show-toplevel') return { stdout: `${io.toplevel}\n`, stderr: '', code: 0 };
        if (key === 'git rev-parse --git-path info/exclude') return { stdout: '.git/info/exclude\n', stderr: '', code: 0 };
      }
      if (cmd === 'openspec') {
        if (openspec === null) return { stdout: '', stderr: '', code: null };
        if (key === 'openspec --version') return { stdout: openspec, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: 'fatal: not a git repository', code: 128 };
    },
    isExecutable: () => false,
    homedir: () => '/home/u',
    now: () => 0,
  };
  return io;
}
