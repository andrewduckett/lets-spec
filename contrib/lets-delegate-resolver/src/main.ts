// The real entry: read the verb and the request, answer, and exit with the
// answer's code. resolver.ts holds the logic; this file wires it to the real
// world.
import { createAdapter as createHerdr } from './herdr.ts';
import { realIo } from 'resolver-kit/io.ts';
import { handle } from './resolver.ts';
import { createAdapter as createT3 } from '../../t3-resolver/src/t3.ts';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const io = realIo();
const answer = await handle(process.argv[2] ?? '', input, { t3: createT3(io), herdr: createHerdr(io) });
process.stdout.write(answer.stdout);
process.stderr.write(answer.stderr);
process.exitCode = answer.code;
