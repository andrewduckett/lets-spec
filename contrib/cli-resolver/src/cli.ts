// In any terminal or harness: each review runs headless, as a child process
// of the family's CLI in its read-only mode, on the model the request names.
// Revived from lets's old built-in default resolver.
//
// A handoff needs a session a person can work in, so start declines and the
// next resolver in the chain answers it.
//
// The child is started by this process, so it gets this process's
// environment without the session markers.
import { join } from 'node:path';
import type { Adapter, Session } from 'resolver-kit/adapter.ts';
import { scrubbedEnv } from 'resolver-kit/env.ts';
import { Refused, SessionFailed, SpawnError, TimeoutError } from 'resolver-kit/errors.ts';
import { HEADLESS_EXECUTOR, withEffort, withoutEffort } from 'resolver-kit/families.ts';
import type { Io } from 'resolver-kit/io.ts';
import { FAMILIES, normalizeName } from 'resolver-kit/protocol.ts';
import type { Effort, Family, ModelString } from 'resolver-kit/protocol.ts';
import { Declined } from 'resolver-kit/verbs.ts';

// Relative to the request's folder. codex writes its last message here.
const SCRATCH = '.workspace/lets-delegate';

const modelArgs = (flag: string, model: string | null) => (model ? [flag, model] : []);

// How long each CLI may take to list its models. Both listings together
// stay inside the verify check's 60 seconds for probe.
const LISTING_TIMEOUT_MS = 20_000;

// The command that lists a family's models, and how to read what it prints.
// claude cannot list its models, so it has none.
const LISTINGS: Partial<Record<Family, { args: string[]; read: (stdout: string) => string[] }>> = {
  // codex debug models prints JSON; a model it shows has visibility "list".
  gpt: {
    args: ['debug', 'models'],
    read: (stdout) => (JSON.parse(stdout) as { models: { slug: string; visibility: string }[] }).models
      .filter(({ visibility }) => visibility === 'list').map(({ slug }) => slug),
  },
  // agy models prints a banner, then one tab-separated line per model, once
  // per effort. It lists other makers' models too, which it cannot run as
  // gemini, so only gemini-* ids count.
  gemini: {
    args: ['models'],
    read: (stdout) => stdout.split('\n').filter((line) => line.startsWith('gemini-')).map((line) => withoutEffort(line.split('\t')[0])),
  },
};

type RunCommandInput = { family: Family; model: string | null; effort: Effort; prompt: string; lastMessagePath: string; timeoutMinutes: number };

// The command for a read-only run, what goes on its stdin, and where its
// final message comes from: stdout, or a file.
export function runCommand({ family, model, effort, prompt, lastMessagePath, timeoutMinutes }: RunCommandInput) {
  const cmd = HEADLESS_EXECUTOR[family];
  if (family === 'gpt') {
    return {
      cmd,
      args: ['exec', '-s', 'read-only', '-c', `model_reasoning_effort="${effort}"`, ...modelArgs('-m', model), '-o', lastMessagePath, '-'],
      input: prompt,
      readResultFrom: lastMessagePath,
    };
  }
  if (family === 'claude') {
    return { cmd, args: ['-p', '--permission-mode', 'plan', '--effort', effort, ...modelArgs('--model', model)], input: prompt, readResultFrom: 'stdout' };
  }
  return {
    cmd,
    args: ['--mode', 'plan', '--effort', effort, ...modelArgs('--model', model && withEffort(model, effort)),
      '--print-timeout', `${timeoutMinutes}m`, '-p', prompt],
    input: undefined,
    readResultFrom: 'stdout',
  };
}

// A run waiting to start: the handle names the session; the rest is what
// waitForResult needs to run the CLI.
type CliSession = Session & { cwd: string; name: string; prompt: string; family: Family; model: string | null; effort: Effort };

export function createAdapter(io: Io): Adapter {
  const lastMessagePath = (cwd: string, name: string) => join(cwd, SCRATCH, `${name}.last-message.md`);

  return {
    name: 'cli',
    program: 'lets-delegate-cli',
    harness: 'this resolver',
    handleKind: 'process',
    // Any terminal or harness will do, as long as one family's CLI is on PATH.
    detect: () => FAMILIES.some((family) => io.commandExists(HEADLESS_EXECUTOR[family])),
    whyDeclined: () => 'none of codex, claude or agy is on PATH',
    // Each family whose CLI is on PATH, gpt, claude, gemini. A listing that
    // fails lists the bare family, so the caller can still try the CLI's
    // default model.
    async options(warn) {
      const onPath = FAMILIES.filter((family) => io.commandExists(HEADLESS_EXECUTOR[family]));
      const lists = await Promise.all(onPath.map(async (family): Promise<ModelString[]> => {
        const listing = LISTINGS[family];
        if (listing === undefined) return [family];
        const cmd = HEADLESS_EXECUTOR[family];
        try {
          const { stdout, stderr, code, timedOut } = await io.execFile(cmd, listing.args, { env: scrubbedEnv(io.env), timeoutMs: LISTING_TIMEOUT_MS });
          if (timedOut) throw new Error(`no answer in ${LISTING_TIMEOUT_MS / 1000} s`);
          if (code !== 0) throw new Error(`exit ${code}: ${stderr.trim().slice(-200)}`);
          return [...new Set(listing.read(stdout))].map((model) => `${family}/${model}`);
        } catch (error) {
          warn(`${cmd} ${listing.args.join(' ')} failed, so ${family} is listed with its default model only: ${(error as Error).message}`);
          return [family];
        }
      }));
      return lists.flat();
    },

    // The CLI starts in waitForResult, which knows the timeout.
    async spawn({ kind, name, cwd, prompt, family, model, effort }): Promise<CliSession> {
      if (kind === 'start') throw new Declined('this resolver only runs headless');
      return { handle: { kind: 'process', id: name }, cwd, name, prompt, family, model, effort: effort! };
    },

    async waitForResult(session, { timeoutMs }) {
      const { cwd, name, prompt, family, model, effort } = session as CliSession;
      io.mkdirp(join(cwd, SCRATCH));
      const timeoutMinutes = Math.ceil(timeoutMs / 60000);
      const { cmd, args, input, readResultFrom } = runCommand({ family, model, effort, prompt, timeoutMinutes, lastMessagePath: lastMessagePath(cwd, name) });
      // A file from an earlier run with this name would hide a refusal.
      if (readResultFrom !== 'stdout' && io.exists(readResultFrom)) io.removeFile(readResultFrom);
      const result = await io.execFile(cmd, args, { cwd, env: scrubbedEnv(io.env), input, timeoutMs }).catch((error: Error) => {
        throw new Refused(error.message);
      });
      if (result.timedOut) throw new TimeoutError(`${cmd} did not finish in ${timeoutMinutes} minutes`);
      const text = readResultFrom === 'stdout' ? result.stdout : (io.exists(readResultFrom) ? io.readFile(readResultFrom) : '');
      if (result.code !== 0) {
        // Nothing printed means the CLI or the account said no before the
        // model gave any output, such as a model it cannot run.
        const printed = result.stdout.trim() !== '' || text.trim() !== '';
        const why = `exit ${result.code}: ${result.stderr.slice(-500)}`;
        throw printed ? new SessionFailed(`${cmd} failed: ${why}`) : new Refused(`${cmd} refused: ${why}`);
      }
      // The kit turns an empty message, or a missing file, into a failed session.
      return { text };
    },

    // Removes the session's files on ok. The handle's id is the session's
    // name, so only a name that is safe in a path removes anything.
    async finish(handle, ok, { cwd }) {
      if (normalizeName(handle.id) !== handle.id) throw new SpawnError('the handle\'s id is not a session name');
      if (!ok) return;
      const path = lastMessagePath(cwd, handle.id);
      if (io.exists(path)) io.removeFile(path);
    },
  };
}
