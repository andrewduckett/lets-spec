// The real entry for a resolver program: read the verb and the request,
// answer with the program's one adapter, and exit with the answer's code.
// resolver.ts holds the logic; this file wires it to the real world.
import type { Adapter } from './adapter.ts';
import { realIo } from './io.ts';
import type { Io } from './io.ts';
import { handle } from './resolver.ts';

export async function runResolver(createAdapter: (io: Io) => Adapter): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  const answer = await handle(process.argv[2] ?? '', input, createAdapter(realIo()));
  process.stdout.write(answer.stdout);
  process.stderr.write(answer.stderr);
  process.exitCode = answer.code;
}
