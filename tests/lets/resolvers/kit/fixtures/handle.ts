// One verb through a resolver with one adapter, as its program would answer
// it: the verb, the request's text, and the adapter in, the answer out.
import type { Adapter } from '../../../../../lets/src/resolvers/kit/adapter.ts';
import { adapterAnswer } from '../../../../../lets/src/resolvers/kit/resolver.ts';
import { respond } from '../../../../../lets/src/resolvers/kit/verbs.ts';
import type { Answer } from '../../../../../lets/src/resolvers/kit/verbs.ts';

export async function handle(verb: string, input: string, adapter: Adapter): Promise<Answer> {
  return respond(adapter.program, verb, input, adapterAnswer(adapter));
}
