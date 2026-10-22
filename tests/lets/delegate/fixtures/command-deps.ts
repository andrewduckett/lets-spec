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
//   commands:  the commands on PATH
//   results:   answers for any other command, in order
//   files:     the files there are; default the prompt file /repo/p.md
//   subagent:  false when lets's own default is missing; default true
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Deps, ExecResult } from '../../../../lets/src/io.ts';
import { realIo } from '../../../../lets/src/io.ts';
import { fakeIo } from './fake-io.ts';

export const FAKE_RESOLVER = fileURLToPath(new URL('fake-resolver', import.meta.url));
export const PROMPT_FILE = '/repo/p.md';
// The Node that runs lets, and the default beside it, as the deps name them.
export const NODE = '/nix/node';
export const SUBAGENT = '/pkg/contrib/lets-delegate-subagent';
const SUBAGENT_SOURCE = fileURLToPath(new URL('../../../../contrib/subagent-resolver/bin/lets-delegate-subagent', import.meta.url));

type Options = {
  resolver?: boolean;
  settings?: Record<string, string>;
  gitBefore?: string;
  gitAfter?: string;
  commands?: string[];
  results?: ExecResult[];
  files?: Record<string, string>;
  subagent?: boolean;
};

export function commandDeps({
  resolver = true, settings = {}, gitBefore = '', gitAfter = gitBefore, commands = [], results = [],
  files = { [PROMPT_FILE]: 'PROMPT TEXT' }, subagent = true,
}: Options = {}) {
  const log = join(mkdtempSync(join(tmpdir(), 'lets-delegate-')), 'calls');
  // Where the real default writes what it would write under /repo.
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'lets-delegate-repo-')));
  const real = realIo();
  const io = fakeIo({ files: subagent ? { ...files, [SUBAGENT]: '' } : files, commands, executables: [FAKE_RESOLVER] });
  // The fake resolver is a real process, so its deadlines are real too.
  io.sleep = real.sleep;
  let statusCalls = 0;
  io.execFile = async (cmd, args, opts = {}) => {
    io.calls.push([cmd, args, opts]);
    if (cmd === 'git' && args[0] === 'rev-parse') return { stdout: '/repo\n', stderr: '', code: 0 };
    if (cmd === 'git') return { stdout: statusCalls++ === 0 ? gitBefore : gitAfter, stderr: '', code: 0 };
    if (cmd === FAKE_RESOLVER) {
      return real.execFile(cmd, args, { ...opts, cwd: undefined, env: { ...process.env, FAKE_RESOLVER_LOG: log, ...settings } });
    }
    if (cmd === NODE && args[0] === SUBAGENT) {
      const request = { ...JSON.parse(opts.input!), cwd: repo };
      const result = await real.execFile(process.execPath, [SUBAGENT_SOURCE, ...args.slice(1)], { ...opts, cwd: repo, input: JSON.stringify(request) });
      return { ...result, stdout: result.stdout.replaceAll(repo, '/repo') };
    }
    opts.started?.({ pid: 4242, kill: () => io.killed.push(4242) });
    return results.shift() ?? { stdout: '', stderr: '', code: 0 };
  };

  const out: string[] = [];
  const err: string[] = [];
  const deps: Deps = {
    env: resolver ? { LETS_SPEC_RESOLVER: FAKE_RESOLVER } : {},
    cwd: '/repo',
    packageRoot: '/pkg', nodePath: NODE,
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

  return { deps, io, stdout: () => out.join(''), stderr: () => err.join(''), resolverCalls, repoFile };
}
