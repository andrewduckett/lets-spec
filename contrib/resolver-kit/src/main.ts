// The real entry for a resolver program: read the verb and the request,
// answer, and exit with the answer's code. verbs.ts and resolver.ts hold the
// logic; this file wires them to the real world.
import type { Adapter } from './adapter.ts';
import { realIo } from './io.ts';
import type { Io } from './io.ts';
import { adapterAnswer } from './resolver.ts';
import { respond } from './verbs.ts';
import type { AnswerFn } from './verbs.ts';

// A program that answers each verb itself, on the verb layer.
export async function runProgram(program: string, createAnswer: (io: Io) => AnswerFn): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  const answer = await respond(program, process.argv[2] ?? '', input, createAnswer(realIo()));
  process.stdout.write(answer.stdout);
  process.stderr.write(answer.stderr);
  process.exitCode = answer.code;
}

// A program with one adapter, which starts sessions in one harness.
export async function runResolver(createAdapter: (io: Io) => Adapter): Promise<void> {
  const adapter = createAdapter(realIo());
  await runProgram(adapter.program, () => adapterAnswer(adapter));
}
