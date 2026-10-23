// A fake of the Io in lets/src/io.ts, for the delegate modules. execFile
// records each call and answers from a queue; files live in a Map.
//
// options:
//   results:     answers for execFile, in order. Each is an ExecResult, a
//                function (cmd, args, opts) returning one, or a promise of
//                one. When the queue is empty, execFile answers code 0.
//   files:       initial files, { path: text }
//   executables: the paths isExecutable finds
//   any Io method replaces the default.
import type { ExecOptions, ExecResult, Io } from '../../../../lets/src/io.ts';

type Result = ExecResult | Promise<ExecResult> | ((cmd: string, args: string[], opts: ExecOptions) => ExecResult | Promise<ExecResult>);

export type FakeIo = Io & {
  calls: [string, string[], ExecOptions][];
  files: Map<string, string>;
  dirs: string[];
  removed: string[];
  killed: number[];
  sleeps: number[];
};

type Options = { results?: Result[]; files?: Record<string, string>; executables?: string[] } & Partial<Io>;

const notInFake = (name: string) => () => {
  throw new Error(`${name} is not in this fake`);
};

export function fakeIo({ results = [], files = {}, executables = [], ...overrides }: Options = {}): FakeIo {
  const io: FakeIo = {
    calls: [],
    files: new Map(Object.entries(files)),
    dirs: [],
    removed: [],
    killed: [],
    sleeps: [],

    async execFile(cmd, args, opts = {}) {
      io.calls.push([cmd, args, opts]);
      opts.started?.({ kill: () => io.killed.push(4242) });
      const next = results.shift() ?? { stdout: '', stderr: '', code: 0 };
      return typeof next === 'function' ? next(cmd, args, opts) : next;
    },
    isExecutable: (path) => executables.includes(path),
    homedir: () => '/home/u',
    now: () => 0,
    // Resolves on the next turn of the event loop, so a command that has
    // already answered wins a race against it.
    async sleep(ms) {
      io.sleeps.push(ms);
      await new Promise((resolve) => setImmediate(resolve));
    },

    readFile: (path) => io.files.get(path) ?? null,
    readBytes: (path) => (io.files.has(path) ? Buffer.from(io.files.get(path)!) : null),
    writeFile: (path, text) => io.files.set(path, text),
    exists: (path) => io.files.has(path),
    remove(path) {
      io.removed.push(path);
      io.files.delete(path);
    },
    mkdirp: (path) => io.dirs.push(path),
    isSymlink: () => false,
    isDir: (path) => io.dirs.includes(path),
    readlink: () => null,
    symlink: notInFake('symlink'),
    stat: notInFake('stat'),
    chmod: notInFake('chmod'),
    copyFile: notInFake('copyFile'),
    listDirs: () => [],
    listNames: () => [],
    listFiles: () => [],
    ...overrides,
  };
  return io;
}
