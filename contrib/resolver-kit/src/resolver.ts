// The resolver: one protocol verb in, one answer out, for one harness.
// probe, run and start go to the adapter when this process is inside its
// harness, and decline when it is not. finish goes to the adapter when the
// handle is of the kind it makes. No process access here; main.ts wires in
// the real world.
import type { Adapter } from './adapter.ts';
import { exitCodeOf, SessionFailed, SpawnError } from './errors.ts';
import { pickFamily, pickReviewer } from './families.ts';
import { DECLINE, parseRequest } from './protocol.ts';
import type { Family, Request, Requests, Response } from './protocol.ts';

// What the process prints, and its exit code.
export type Answer = { code: number; stdout: string; stderr: string };

const ok = (response: Response, stderr = ''): Answer => ({ code: 0, stdout: `${JSON.stringify(response)}\n`, stderr });
const declined = (adapter: Adapter): Answer => ({ code: DECLINE, stdout: '', stderr: `${adapter.program}: not inside ${adapter.harness}\n` });

export async function handle(verb: string, input: string, adapter: Adapter): Promise<Answer> {
  try {
    return await answer(verb, parseRequest(verb, input), adapter);
  } catch (error) {
    const code = exitCodeOf(error);
    if (code === null) throw error;
    return { code, stdout: '', stderr: `${adapter.program}: ${(error as Error).message}\n` };
  }
}

async function answer(verb: string, request: Request, adapter: Adapter): Promise<Answer> {
  if (verb === 'finish') return finish(request as Requests['finish'], adapter);
  if (!adapter.detect()) return declined(adapter);
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

// Clean up after a session, from anywhere: finish does not check detect().
// It never fails because the session is gone: a failure is reported on
// stderr, and the exit is still 0.
async function finish({ handle, ok: succeeded }: Requests['finish'], adapter: Adapter): Promise<Answer> {
  if (handle.kind !== adapter.handleKind) throw new SpawnError(`${adapter.harness} makes no handle of kind ${handle.kind}`);
  try {
    await adapter.finish(handle, succeeded);
    return ok({});
  } catch (error) {
    if (exitCodeOf(error) === null) throw error;
    return ok({}, `${adapter.program}: could not finish ${handle.kind} ${handle.id}: ${(error as Error).message}\n`);
  }
}
