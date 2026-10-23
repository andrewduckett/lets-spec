// The adapter layer: the verb layer's answer for a resolver that starts
// sessions in one harness. probe, run and start go to the adapter when this
// process is inside its harness, and decline when it is not, with the
// adapter's own reason when it gives one. A run or start the adapter does
// not take declines, and so does a probe for it. finish goes to
// the adapter when the handle is of the kind it makes. No process access
// here; main.ts wires in the real world.
import type { Adapter } from './adapter.ts';
import { exitCodeOf, Refused, SessionFailed, SpawnError } from './errors.ts';
import { parseModel } from './protocol.ts';
import type { Model, Request, Requests, Response, SessionVerb, Verb } from './protocol.ts';
import { Declined } from './verbs.ts';
import type { AnswerFn } from './verbs.ts';

// The answer function for a program with one adapter.
export function adapterAnswer(adapter: Adapter): AnswerFn {
  return async (verb: Verb, request: Request, warn: (message: string) => void): Promise<Response> => {
    if (verb === 'finish') return finish(request as Requests['finish'], adapter, warn);
    const wanted = verb === 'probe' ? (request as Requests['probe']).verb : verb;
    if (wanted !== undefined && !takes(adapter, wanted)) throw new Declined(wanted === 'start' ? 'this resolver only runs headless' : 'this resolver only starts interactive sessions');
    if (!adapter.detect()) throw new Declined(adapter.whyDeclined?.() ?? `not inside ${adapter.harness}`);
    if (verb === 'probe') return { resolver: adapter.name, options: await adapter.options(warn) };
    if (verb === 'start') {
      const { cwd, name, prompt, model } = request as Requests['start'];
      const { handle } = await adapter.spawn({ kind: 'start', name, prompt, cwd, ...modelOf(model), effort: null, readOnly: false });
      return { resolver: adapter.name, handle };
    }
    return run(adapter, request as Requests['run'], warn);
  };
}

const takes = (adapter: Adapter, verb: SessionVerb) => (adapter.verbs ?? ['run', 'start']).includes(verb);

// The request's model, which parseRequest has already checked.
const modelOf = (text: string): Model => parseModel(text)!;

// Start a read-only session on the request's model, and wait for its final
// message. A failure leaves the session in place, so a person can read it,
// except a refusal: nothing ran, so the session is finished as ok.
async function run(adapter: Adapter, { cwd, name, prompt, effort, timeoutMinutes, model: text }: Requests['run'], warn: (message: string) => void): Promise<Response> {
  const { family, model } = modelOf(text);
  const session = await adapter.spawn({ kind: 'run', name, prompt, cwd, family, model, effort, readOnly: true });
  const where = `(${session.handle.kind} ${session.handle.id})`;
  try {
    const { text } = await adapter.waitForResult(session, { timeoutMs: timeoutMinutes * 60000 });
    if (text.trim() === '') throw new SessionFailed('empty final message');
    return { resolver: adapter.name, text, family, model, handle: session.handle };
  } catch (error) {
    if (error instanceof Refused) await finish({ cwd, handle: session.handle, ok: true }, adapter, warn);
    if (error instanceof Error && exitCodeOf(error) !== null) error.message = `${error.message} ${where}`;
    throw error;
  }
}

// Clean up after a session, from anywhere: finish does not check detect().
// It never fails because the session is gone: a failure is reported on
// stderr, and the exit is still 0.
async function finish({ cwd, handle, ok: succeeded }: Pick<Requests['finish'], 'cwd' | 'handle' | 'ok'>, adapter: Adapter, warn: (message: string) => void): Promise<Response> {
  if (handle.kind !== adapter.handleKind) throw new SpawnError(`${adapter.harness} makes no handle of kind ${handle.kind}`);
  try {
    await adapter.finish(handle, succeeded, { cwd });
  } catch (error) {
    if (exitCodeOf(error) === null) throw error;
    warn(`could not finish ${handle.kind} ${handle.id}: ${(error as Error).message}`);
  }
  return {};
}
