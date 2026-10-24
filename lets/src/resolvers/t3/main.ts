// The real entry for lets-delegate-t3. The kit holds the protocol; t3.ts
// holds the harness.
import { runResolver } from '../kit/main.ts';
import { createAdapter } from './t3.ts';

await runResolver(createAdapter);
