// The real entry for lets-delegate-herdr. The kit holds the protocol;
// herdr.ts holds the harness.
import { runResolver } from 'resolver-kit/main.ts';
import { createAdapter } from './herdr.ts';

await runResolver(createAdapter);
