// One verb through a resolver with one adapter, as its program would answer
// it: the verb, the request's text, and the adapter in, the answer out.
import type { Adapter } from '../../../contrib/resolver-kit/src/adapter.ts';
import { adapterAnswer } from '../../../contrib/resolver-kit/src/resolver.ts';
import { respond } from '../../../contrib/resolver-kit/src/verbs.ts';
import type { Answer } from '../../../contrib/resolver-kit/src/verbs.ts';

export async function handle(verb: string, input: string, adapter: Adapter): Promise<Answer> {
  return respond(adapter.program, verb, input, adapterAnswer(adapter));
}
