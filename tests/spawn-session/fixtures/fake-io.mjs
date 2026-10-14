// A fake of the io object the adapters take. execFile records each call and
// answers from a queue; files live in a Map.
//
// overrides:
//   results:  answers for execFile, in order. Each is { stdout, stderr, code },
//             a function (cmd, args, opts) returning one, or a promise.
//   files:    initial files, { path: text }
//   commands: the commands commandExists finds
//   any other io field replaces the default.
export function fakeIo({ results = [], files = {}, commands = [], ...overrides } = {}) {
  const io = {
    calls: [],
    detached: [],
    files: new Map(Object.entries(files)),
    modes: new Map(),
    dirs: [],
    removed: [],
    commands: new Set(commands),

    async execFile(cmd, args, opts = {}) {
      io.calls.push([cmd, args, opts]);
      const next = results.shift() ?? { stdout: '', stderr: '', code: 0 };
      return typeof next === 'function' ? next(cmd, args, opts) : next;
    },
    spawnDetached(cmd, args, opts) {
      io.detached.push([cmd, args, opts]);
      return { pid: 4242 };
    },
    commandExists: (cmd) => io.commands.has(cmd),
    readFile(path) {
      if (!io.files.has(path)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      return io.files.get(path);
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
    openDb: () => { throw new Error('no database in this fake'); },
    fetch: async () => { throw new Error('no network in this fake'); },
    WebSocket: class { constructor() { throw new Error('no network in this fake'); } },
    now: () => 0,
    sleep: async () => {},
    env: { PATH: '/bin', CLAUDECODE: '1' },
    ...overrides,
  };
  return io;
}
