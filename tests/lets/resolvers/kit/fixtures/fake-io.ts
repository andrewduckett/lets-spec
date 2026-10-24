// A fake of the io the adapters take. execFile records each call and answers
// from a queue; files live in a Map.
//
// options:
//   results:  answers for execFile, in order. Each is an ExecResult, or a
//             function (cmd, args, opts) returning one.
//   files:    initial files, { path: text }
//   commands: the commands commandExists finds
//   any other io field replaces the default.
import type { ExecOptions, ExecResult, Io } from '../../../../../lets/src/resolvers/kit/io.ts';

type Result = ExecResult | ((cmd: string, args: string[], opts: ExecOptions) => ExecResult);

export type FakeIo = Io & {
  calls: [string, string[], ExecOptions][];
  files: Map<string, string>;
  modes: Map<string, number>;
  dirs: string[];
  removed: string[];
};

type Options = { results?: Result[]; files?: Record<string, string>; commands?: string[] } & Partial<Io>;

export function fakeIo({ results = [], files = {}, commands = [], ...overrides }: Options = {}): FakeIo {
  const io: FakeIo = {
    calls: [],
    files: new Map(Object.entries(files)),
    modes: new Map(),
    dirs: [],
    removed: [],

    async execFile(cmd, args, opts = {}) {
      io.calls.push([cmd, args, opts]);
      const next = results.shift() ?? { stdout: '', stderr: '', code: 0 };
      return typeof next === 'function' ? next(cmd, args, opts) : next;
    },
    commandExists: (cmd) => commands.includes(cmd),
    readFile(path) {
      if (!io.files.has(path)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      return io.files.get(path)!;
    },
    exists: (path) => io.files.has(path),
    writeFile(path, text, { mode } = {}) {
      io.files.set(path, text);
      if (mode !== undefined) io.modes.set(path, mode);
    },
    removeFile(path) {
      io.removed.push(path);
      io.files.delete(path);
    },
    mkdirp(path, { mode } = {}) {
      io.dirs.push(path);
      if (mode !== undefined) io.modes.set(path, mode);
    },
    homedir: () => '/home/u',
    pid: 100,
    parentPid: () => null,
    processAlive: () => false,
    openDb: () => {
      throw new Error('no database in this fake');
    },
    fetch: async () => {
      throw new Error('no network in this fake');
    },
    WebSocket: class {
      constructor() {
        throw new Error('no network in this fake');
      }
    } as unknown as typeof WebSocket,
    now: () => 0,
    sleep: async () => {},
    env: { PATH: '/bin', CLAUDECODE: '1' },
    ...overrides,
  };
  return io;
}
