// The real entry for lets-delegate-subagent. The kit holds the protocol;
// subagent.ts holds the answers.
import { runProgram } from '../kit/main.ts';
import { createAnswer, PROGRAM } from './subagent.ts';

await runProgram(PROGRAM, createAnswer);
