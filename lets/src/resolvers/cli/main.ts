// The real entry for lets-delegate-cli. The kit holds the protocol;
// cli.ts holds the harness.
import { runResolver } from '../kit/main.ts';
import { createAdapter } from './cli.ts';

await runResolver(createAdapter);
