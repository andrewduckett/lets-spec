// The verb layer: one protocol verb in, one answer out, for any resolver.
// It parses the request, asks the program's answer function, and turns what
// comes back into what the process prints and its exit code. resolver.ts
// builds the adapter layer on it, for resolvers that start sessions. No
// process access here; main.ts wires in the real world.
import { exitCodeOf } from './errors.ts';
import { DECLINE, parseRequest } from './protocol.ts';
import type { Request, Response, Verb } from './protocol.ts';

// What the process prints, and its exit code.
export type Answer = { code: number; stdout: string; stderr: string };

// The resolver does not handle this request here, and has started nothing.
// The message says why, such as "not inside T3 Code".
export class Declined extends Error {}

// A program's answer to one verb: the response to print, or null to print
// nothing. warn adds a line to stderr under the program's name. It throws a
// kit error, or Declined, to exit with that error's code.
export type AnswerFn = (verb: Verb, request: Request, warn: (message: string) => void) => Promise<Response | null>;

export async function respond(program: string, verb: string, input: string, answer: AnswerFn): Promise<Answer> {
  const line = (message: string) => `${program}: ${message}\n`;
  let stderr = '';
  try {
    const response = await answer(verb as Verb, parseRequest(verb, input), (message) => { stderr += line(message); });
    return { code: 0, stdout: response === null ? '' : `${JSON.stringify(response)}\n`, stderr };
  } catch (error) {
    const code = error instanceof Declined ? DECLINE : exitCodeOf(error);
    if (code === null) throw error;
    return { code, stdout: '', stderr: stderr + line((error as Error).message) };
  }
}
