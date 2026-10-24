// The strategies of lets delegate. A strategy fixes how a session runs: its
// options, its output, its exit codes, and the protocol verb it sends. Each
// takes the intents it serves, and the intent picks the user's guidance.
import type { SessionVerb } from '../resolvers/kit/protocol.ts';

export type Strategy = 'review' | 'handoff';
export type Intent = 'plan' | 'code' | 'apply';

export const STRATEGIES: Record<Strategy, { intents: readonly Intent[]; verb: SessionVerb }> = {
  // Read-only, and waits for the final message.
  review: { intents: ['plan', 'code'], verb: 'run' },
  // Interactive, and returns at once.
  handoff: { intents: ['apply'], verb: 'start' },
};
