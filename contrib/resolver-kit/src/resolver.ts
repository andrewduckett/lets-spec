// The adapter layer: the verb layer's answer for a resolver that starts
// sessions in one harness. probe, run and start go to the adapter when this
// process is inside its harness, and decline when it is not, with the
// adapter's own reason when it gives one. finish goes to
// the adapter when the handle is of the kind it makes. No process access
// here; main.ts wires in the real world.
import type { Adapter } from './adapter.ts';
import { exitCodeOf, SessionFailed, SpawnError } from './errors.ts';
import { pickFamily, pickReviewer } from './families.ts';
import type { Family, Request, Requests, Response, Verb } from './protocol.ts';
import { Declined, respond } from './verbs.ts';
import type { Answer, AnswerFn } from './verbs.ts';

export type { Answer };

export async function handle(verb: string, input: string, adapter: Adapter): Promise<Answer> {
  return respond(adapter.program, verb, input, adapterAnswer(adapter));
}

// The answer function for a program with one adapter.
export function adapterAnswer(adapter: Adapter): AnswerFn {
  return async (verb: Verb, request: Request, warn: (message: string) => void): Promise<Response> => {
    if (verb === 'finish') return finish(request as Requests['finish'], adapter, warn);
    if (!adapter.detect()) throw new Declined(adapter.whyDeclined?.() ?? `not inside ${adapter.harness}`);
    if (verb === 'probe') return { resolver: adapter.name };
    if (verb === 'start') {
      const { cwd, name, prompt } = request as Requests['start'];
      const { handle } = await adapter.spawn({ kind: 'start', name, prompt, cwd, family: 'claude', model: null, effort: null, readOnly: false });
      return { resolver: adapter.name, handle };
    }
    return run(adapter, request as Requests['run']);
  };
}

// Pick a family, start a read-only session, and wait for its final message.
// A failure leaves the session in place, so a person can read it.
async function run(adapter: Adapter, { cwd, name, prompt, sourceFamily, effort, timeoutMinutes, reviewers }: Requests['run']): Promise<Response> {
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
    return { resolver: adapter.name, text, family, model, handle: session.handle };
  } catch (error) {
    if (error instanceof Error && exitCodeOf(error) !== null) error.message = `${error.message} ${where}`;
    throw error;
  }
}

// Clean up after a session, from anywhere: finish does not check detect().
// It never fails because the session is gone: a failure is reported on
// stderr, and the exit is still 0.
async function finish({ cwd, handle, ok: succeeded }: Requests['finish'], adapter: Adapter, warn: (message: string) => void): Promise<Response> {
  if (handle.kind !== adapter.handleKind) throw new SpawnError(`${adapter.harness} makes no handle of kind ${handle.kind}`);
  try {
    await adapter.finish(handle, succeeded, { cwd });
  } catch (error) {
    if (exitCodeOf(error) === null) throw error;
    warn(`could not finish ${handle.kind} ${handle.id}: ${(error as Error).message}`);
  }
  return {};
}
