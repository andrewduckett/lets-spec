// Deps for the review and handoff commands. git is scripted; the fake
// resolver runs as a real process with its settings in its env; the default,
// lets-delegate-subagent, runs as the real source program in a temporary
// folder that stands in for /repo; any other command answers from a queue.
//
// options:
//   resolver:  true to set LETS_SPEC_RESOLVER to the fake resolver
//   settings:  the fake resolver's FAKE_RESOLVER_* variables
//   gitBefore: what `git status -z` prints before the session
//   gitAfter:  what it prints after; default gitBefore
//   gitAfterFails: true when `git status` fails after the session
//   executables: more paths that are executable files, beside the fake
//              resolver; they answer from results when run
//   results:   answers for any other command, in order
//   files:     the files there are; default the prompt file /repo/p.md
//   config:    the text of the delegate config, CONFIG, when there is one
//   subagent:  false when lets's own default is missing; default true
//   adapters:  how each resolver built into lets behaves, by name, as a
//              FakeResolver; t3 and cli decline by default, and subagent is
//              the real one, writing to a fake under /repo
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResolverName } from '../../../../lets/src/delegate/config.ts';
import type { Deps, ExecResult } from '../../../../lets/src/io.ts';
import { realIo } from '../../../../lets/src/io.ts';
import type { Adapter, RunInput, StartInput } from '../../../../lets/src/resolvers/kit/adapter.ts';
import { Refused } from '../../../../lets/src/resolvers/kit/errors.ts';
import type { Handle } from '../../../../lets/src/resolvers/kit/protocol.ts';
import { createAdapter as subagentAdapter } from '../../../../lets/src/resolvers/subagent/subagent.ts';
import { fakeIo as fakeResolverIo } from '../../resolvers/kit/fixtures/fake-io.ts';
import { fakeIo } from './fake-io.ts';

export const FAKE_RESOLVER = fileURLToPath(new URL('fake-resolver', import.meta.url));
export const PROMPT_FILE = '/repo/p.md';
export const CONFIG = '/home/u/.config/lets-delegate/config.yaml';
// The Node that runs lets, and the default beside it, as the deps name them.
export const NODE = '/nix/node';
export const SUBAGENT = '/pkg/resolvers/lets-delegate-subagent';
const SUBAGENT_SOURCE = fileURLToPath(new URL('../../../../lets/resolvers/lets-delegate-subagent', import.meta.url));

// How a fake resolver behaves. By default it detects, starts sessions,
// lists gpt/fake-model, and answers run with FINDINGS on handle
// <name> <name>-1, and start with handle <name> <name>-1.
//   declines: detect() is false
//   headless: it has no start
//   options:  the models options lists
//   warnings: what options warns, in order
//   refuse:   the models run and start refuse, as --model gives them
//   run, start: the answer, or the error to throw
//   finish:   the error finish throws
export type FakeResolver = {
  declines?: boolean;
  headless?: boolean;
  options?: string[];
  warnings?: string[];
  refuse?: string[];
  run?: { text?: string; handle?: Handle } | Error;
  start?: Handle | { instructions: string } | Error;
  finish?: Error;
};

// One call an adapter took: the resolver, the method, and its input.
export type AdapterCall = [ResolverName, string, unknown];

// The model an input asks for, as --model gives it.
const modelOf = ({ family, model }: { family: string; model: string | null }) => (model === null ? family : `${family}/${model}`);

export function fakeAdapter(name: ResolverName, behaviour: FakeResolver = {}): Adapter {
  const handle = { kind: name, id: `${name}-1` };
  const answer = <T>(value: T | Error): T => {
    if (value instanceof Error) throw value;
    return value;
  };
  const refuses = (input: RunInput | StartInput) => {
    if (behaviour.refuse?.includes(modelOf(input))) throw new Refused(`refused ${modelOf(input)}`);
  };
  return {
    name, program: `lets-delegate-${name}`, harness: name, handleKind: name,
    detect: () => behaviour.declines !== true,
    async options(warn) {
      for (const message of behaviour.warnings ?? []) warn(message);
      return behaviour.options ?? ['gpt/fake-model'];
    },
    async run(input) {
      refuses(input);
      const { text = 'FINDINGS', handle: made = handle } = answer(behaviour.run ?? {});
      return { text, handle: made };
    },
    ...(behaviour.headless ? {} : {
      async start(input: StartInput) {
        refuses(input);
        return answer(behaviour.start ?? handle);
      },
    }),
    async finish() {
      if (behaviour.finish) throw behaviour.finish;
    },
  };
}

// adapter, recording each call it takes in calls.
function recorded(adapter: Adapter, calls: AdapterCall[]): Adapter {
  const name = adapter.name as ResolverName;
  const log = (method: string, input: unknown) => calls.push([name, method, input]);
  const { start } = adapter;
  return {
    ...adapter,
    detect: () => {
      log('detect', null);
      return adapter.detect();
    },
    options: (warn) => {
      log('options', null);
      return adapter.options(warn);
    },
    run: (input, options) => {
      log('run', { input, options });
      return adapter.run(input, options);
    },
    ...(start === undefined ? {} : {
      start: (input: StartInput) => {
        log('start', input);
        return start(input);
      },
    }),
    finish: (handle, ok, options) => {
      log('finish', { handle, ok, options });
      return adapter.finish(handle, ok, options);
    },
  };
}

type Options = {
  adapters?: Partial<Record<ResolverName, FakeResolver>>;
  resolver?: boolean;
  settings?: Record<string, string>;
  gitBefore?: string;
  gitAfter?: string;
  gitAfterFails?: boolean;
  executables?: string[];
  results?: ExecResult[];
  files?: Record<string, string>;
  config?: string;
  subagent?: boolean;
};

export function commandDeps({
  adapters = {}, resolver = true, settings = {}, gitBefore = '', gitAfter = gitBefore, gitAfterFails = false, executables = [], results = [],
  files = { [PROMPT_FILE]: 'PROMPT TEXT' }, config, subagent = true,
}: Options = {}) {
  const log = join(mkdtempSync(join(tmpdir(), 'lets-delegate-')), 'calls');
  // Where the real default writes what it would write under /repo.
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'lets-delegate-repo-')));
  const real = realIo();
  const all = { ...files, ...(config === undefined ? {} : { [CONFIG]: config }), ...(subagent ? { [SUBAGENT]: '' } : {}) };
  const io = fakeIo({ files: all, executables: [FAKE_RESOLVER, ...executables] });
  let statusCalls = 0;
  io.execFile = async (cmd, args, opts = {}) => {
    io.calls.push([cmd, args, opts]);
    if (cmd === 'git' && args[0] === 'rev-parse') return { stdout: '/repo\n', stderr: '', code: 0 };
    if (cmd === 'git') {
      if (statusCalls++ === 0) return { stdout: gitBefore, stderr: '', code: 0 };
      return gitAfterFails ? { stdout: '', stderr: 'index.lock exists', code: 128 } : { stdout: gitAfter, stderr: '', code: 0 };
    }
    if (cmd === FAKE_RESOLVER) {
      return real.execFile(cmd, args, { ...opts, cwd: undefined, env: { ...process.env, FAKE_RESOLVER_LOG: log, ...settings } });
    }
    if (cmd === NODE && args[0] === SUBAGENT) {
      // As Node answers when the script it is given does not exist.
      if (!io.exists(SUBAGENT)) return { stdout: '', stderr: `Error: Cannot find module '${SUBAGENT}'`, code: 1 };
      const request = { ...JSON.parse(opts.input!), cwd: repo };
      const result = await real.execFile(process.execPath, [SUBAGENT_SOURCE, ...args.slice(1)], { ...opts, cwd: repo, input: JSON.stringify(request) });
      return { ...result, stdout: result.stdout.replaceAll(repo, '/repo') };
    }
    return results.shift() ?? { stdout: '', stderr: '', code: 0 };
  };

  // What the real subagent writes, by its path under /repo.
  const resolverIo = fakeResolverIo();
  const calls: AdapterCall[] = [];
  const built = (name: ResolverName, fallback: () => Adapter) =>
    recorded(adapters[name] === undefined ? fallback() : fakeAdapter(name, adapters[name]), calls);
  const resolvers = {
    t3: built('t3', () => fakeAdapter('t3', { declines: true })),
    cli: built('cli', () => fakeAdapter('cli', { declines: true })),
    subagent: built('subagent', () => subagentAdapter(resolverIo)),
  };

  const out: string[] = [];
  const err: string[] = [];
  const deps: Deps = {
    env: resolver ? { LETS_SPEC_RESOLVER: FAKE_RESOLVER } : {},
    cwd: '/repo',
    packageRoot: '/pkg', nodePath: NODE,
    resolvers,
    io,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  };

  // Each call the fake resolver took: its verb and the request it read.
  function resolverCalls(): [string, Record<string, unknown>][] {
    let text = '';
    try {
      text = readFileSync(log, 'utf8');
    } catch {
      return [];
    }
    return text.trim().split('\n').map((line) => {
      const [verb, request] = line.split('\t');
      return [verb, JSON.parse(request)];
    });
  }

  // A file the default wrote, by its path under /repo, or null.
  function repoFile(path: string): string | null {
    try {
      return readFileSync(join(repo, path), 'utf8');
    } catch {
      return null;
    }
  }

  // Each call the adapters took, or only those of one method.
  const adapterCalls = (method?: string) => calls.filter(([, m]) => method === undefined || m === method);
  // A file the real subagent wrote, by its path under /repo, or null.
  const savedFile = (path: string) => resolverIo.files.get(`/repo/${path}`) ?? null;

  return { deps, io, stdout: () => out.join(''), stderr: () => err.join(''), resolverCalls, repoFile, adapterCalls, savedFile };
}
