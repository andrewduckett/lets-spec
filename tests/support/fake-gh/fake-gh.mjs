// A fake gh, for the tests that spawn a real script. The gh beside this file
// runs it. It appends its arguments, as one JSON array, to $FAKE_GH_LOG, then
// answers from $FAKE_GH_ANSWERS, a JSON file holding [{ args, stdout?,
// stderr?, code? }]: the first entry whose args equal its own, else empty
// stdout and code 0.
import { appendFileSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const argv = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify(argv)}\n`);

const answers = process.env.FAKE_GH_ANSWERS
  ? JSON.parse(readFileSync(process.env.FAKE_GH_ANSWERS, 'utf8'))
  : [];
const answer = answers.find((each) => isDeepStrictEqual(each.args, argv)) ?? {};
process.stdout.write(answer.stdout ?? '');
process.stderr.write(answer.stderr ?? '');
process.exitCode = answer.code ?? 0;
