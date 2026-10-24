// The adapter layer: the verb layer's answer for a resolver that starts
// sessions in one harness. probe, run and start go to the adapter when this
// process is inside its harness, and decline when it is not, with the
// adapter's own reason when it gives one. A run or start the adapter does
// not take declines, and so does a probe for it. finish goes to
// the adapter when the handle is of the kind it makes. No process access
// here; main.ts wires in the real world.
import type { Adapter } from './adapter.ts';
import { exitCodeOf, SessionFailed, SpawnError } from './errors.ts';
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
      return { resolver: adapter.name, handle: await adapter.start!({ name, prompt, cwd, ...modelOf(model) }) };
    }
    return run(adapter, request as Requests['run']);
  };
}

const takes = (adapter: Adapter, verb: SessionVerb) => (adapter.verbs ?? ['run', 'start']).includes(verb);

// The request's model, which parseRequest has already checked.
const modelOf = (text: string): Model => parseModel(text)!;

// Run a read-only session on the request's model, and wait for its final
// message. The adapter cleans up after a refusal, and names the session in an
// error it throws after the session exists.
async function run(adapter: Adapter, { cwd, name, prompt, effort, timeoutMinutes, model: text }: Requests['run']): Promise<Response> {
  const { family, model } = modelOf(text);
  const { handle, text: final } = await adapter.run({ name, prompt, cwd, family, model, effort }, { timeoutMs: timeoutMinutes * 60000 });
  if (final.trim() === '') throw new SessionFailed(`empty final message (${handle.kind} ${handle.id})`);
  return { resolver: adapter.name, text: final, family, model, handle };
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
