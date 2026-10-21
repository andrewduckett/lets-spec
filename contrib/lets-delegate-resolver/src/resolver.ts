// The resolver: one protocol verb in, one answer out. probe, run and start go
// to the first harness this process is inside, T3 then herdr, and decline
// when it is inside neither. finish goes to the harness the handle names. No
// process access here; main.ts wires in the real world.
import type { Adapter } from './adapter.ts';
import { exitCodeOf, SessionFailed, SpawnError } from 'resolver-kit/errors.ts';
import { pickFamily, pickReviewer } from 'resolver-kit/families.ts';
import { DECLINE, parseRequest } from 'resolver-kit/protocol.ts';
import type { Family, Request, Requests, Response } from 'resolver-kit/protocol.ts';

// What the process prints, and its exit code.
export type Answer = { code: number; stdout: string; stderr: string };

// The adapters, in the order probe tries them, and the harness each
// handle kind belongs to.
export type Adapters = { t3: Adapter; herdr: Adapter };
const HANDLE_KINDS: Record<string, keyof Adapters> = { thread: 't3', tab: 'herdr' };

const ok = (response: Response, stderr = ''): Answer => ({ code: 0, stdout: `${JSON.stringify(response)}\n`, stderr });
const declined = (): Answer => ({ code: DECLINE, stdout: '', stderr: 'lets-delegate-resolver: not inside T3 or herdr\n' });

export async function handle(verb: string, input: string, adapters: Adapters): Promise<Answer> {
  try {
    return await answer(verb, parseRequest(verb, input), adapters);
  } catch (error) {
    const code = exitCodeOf(error);
    if (code === null) throw error;
    return { code, stdout: '', stderr: `lets-delegate-resolver: ${(error as Error).message}\n` };
  }
}

async function answer(verb: string, request: Request, adapters: Adapters): Promise<Answer> {
  if (verb === 'finish') return finish(request as Requests['finish'], adapters);
  const adapter = [adapters.t3, adapters.herdr].find((candidate) => candidate.detect());
  if (adapter === undefined) return declined();
  if (verb === 'probe') return ok({ resolver: adapter.name });
  if (verb === 'start') {
    const { cwd, name, prompt } = request as Requests['start'];
    const { handle } = await adapter.spawn({ kind: 'start', name, prompt, cwd, family: 'claude', model: null, effort: null, readOnly: false });
    return ok({ resolver: adapter.name, handle });
  }
  return run(adapter, request as Requests['run']);
}

// Pick a family, start a read-only session, and wait for its final message.
// A failure leaves the session in place, so a person can read it.
async function run(adapter: Adapter, { cwd, name, prompt, sourceFamily, effort, timeoutMinutes, reviewers }: Requests['run']): Promise<Answer> {
  const available = adapter.availableFamilies({ effort });
  const whyNot = (family: Family) => adapter.whyNot?.(family) ?? `${adapter.name} cannot run ${family}`;
  const { family, model } = reviewers === undefined
    ? pickFamily({ sourceFamily, available })
    : pickReviewer({ sourceFamily, reviewers, available, whyNot });
  const session = await adapter.spawn({ kind: 'run', name, prompt, cwd, family, model, effort, readOnly: true });
  const where = `(${session.handle.kind} ${session.handle.id})`;
  try {
    const { text } = await adapter.waitForResult(session, { timeoutMs: timeoutMinutes * 60000 });
    if (text.trim() === '') throw new SessionFailed('empty final message');
    return ok({ resolver: adapter.name, text, family, model, handle: session.handle });
  } catch (error) {
    if (error instanceof Error && exitCodeOf(error) !== null) error.message = `${error.message} ${where}`;
    throw error;
  }
}

// Clean up after a session. It never fails because the session is gone: a
// failure is reported on stderr, and the exit is still 0.
async function finish({ handle, ok: succeeded }: Requests['finish'], adapters: Adapters): Promise<Answer> {
  const adapter = HANDLE_KINDS[handle.kind] ? adapters[HANDLE_KINDS[handle.kind]] : undefined;
  if (adapter === undefined) throw new SpawnError(`no harness makes a handle of kind ${handle.kind}`);
  try {
    await adapter.finish(handle, succeeded);
    return ok({});
  } catch (error) {
    if (exitCodeOf(error) === null) throw error;
    return ok({}, `lets-delegate-resolver: could not finish ${handle.kind} ${handle.id}: ${(error as Error).message}\n`);
  }
}
