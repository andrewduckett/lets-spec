// lets delegate conformance: check that a resolver keeps the contract. The
// shape part sends requests that start nothing. The live part, with --live,
// runs a real session and starts another, so it spends tokens and may open
// a thread. No process access here; everything comes through deps.
import type { Child, Deps } from '../io.ts';
import { ContractError, EXIT, UsageError } from './errors.ts';
import { isTreeClean, repoRoot, treeStatus } from './git.ts';
import { buildRequest, DECLINE, FAMILIES, parseResponse, PROTOCOL } from './protocol.ts';
import type { Responses, Verb } from './protocol.ts';
import { withTimeout } from './wait.ts';

export type ConformanceOptions = { command: string[]; live: boolean };

const SHAPE_TIMEOUT_MS = 60000;
const LIVE_RUN_MINUTES = 5;
// The live run waits the session's timeout, plus a minute, as review does.
const LIVE_TIMEOUT_MS = (LIVE_RUN_MINUTES + 1) * 60000;
const NAME = 'lets-conformance';
const NEVER_ISSUED = { kind: 'lets-conformance', id: 'never-issued' };
// The live run lists every family with its default model, so a resolver that
// walks the list can run one, and one that ignores it still passes.
const LIVE_REVIEWERS = FAMILIES.map((family) => ({ family, model: null }));

type Call = { code: number | null; stdout: string; stderr: string };

// The exit code: 0 when every check passes, 1 when one fails, 2 usage.
export async function run({ command, live }: ConformanceOptions, deps: Deps): Promise<number> {
  const [cmd, ...args] = command;
  if (cmd === undefined) {
    deps.stderr('lets delegate: conformance needs a resolver command\n');
    return EXIT.usage;
  }
  let failures = 0;
  const report = (name: string, failure: string | null) => {
    if (failure !== null) failures++;
    deps.stdout(failure === null ? `ok    ${name}\n` : `FAIL  ${name}: ${failure}\n`);
  };

  // Runs the resolver with a verb and stdin. code is null when it cannot
  // start, or when it ran past timeoutMs and was stopped.
  async function call(verb: string, input: string, timeoutMs = SHAPE_TIMEOUT_MS): Promise<Call> {
    const started: { child?: Child } = {};
    const finished = deps.io.execFile(cmd, [...args, verb], { cwd, input, started: (child) => { started.child = child; } });
    const result = await withTimeout(deps.io, finished, timeoutMs);
    if (result !== null) return result;
    started.child?.kill();
    return { code: null, stdout: '', stderr: `no answer in ${Math.round(timeoutMs / 1000)} seconds, so it was stopped` };
  }

  // The live part needs git for the tree check. The shape part does not.
  let cwd = deps.cwd;
  try {
    cwd = await repoRoot(deps.cwd, deps.io);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    if (live) {
      deps.stderr(`lets delegate: ${error.message}\n`);
      return EXIT.usage;
    }
  }
  const probe = (fields = {}) => JSON.stringify({ ...buildRequest('probe', { cwd }), ...fields });

  report('probe answers { resolver } or declines with 75', checkProbe(await call('probe', probe())));
  report('an unknown verb exits 2', exits(await call('lets-conformance-verb', probe()), [2]));
  report('a request that is not JSON exits 2', exits(await call('probe', 'not json'), [2]));
  report(`protocol 99 exits 2 (this is protocol ${PROTOCOL})`, exits(await call('probe', probe({ protocol: 99 })), [2]));
  const unknown = await call('finish', JSON.stringify(buildRequest('finish', { cwd, handle: NEVER_ISSUED, ok: true })));
  report('finish with a handle never issued exits 0 or 4 and prints nothing', exits(unknown, [0, 4]) ?? silent(unknown));

  if (live) {
    const before = await treeStatus(cwd, deps.io);
    const runRequest = buildRequest('run', {
      cwd, name: NAME, prompt: 'Reply with the single word ready and stop.', sourceFamily: 'claude', effort: 'low', timeoutMinutes: LIVE_RUN_MINUTES,
      reviewers: LIVE_REVIEWERS,
    });
    const ran = await call('run', JSON.stringify(runRequest), LIVE_TIMEOUT_MS);
    const response = parsed('run', ran);
    report('run answers with text, a known family and resolver', typeof response === 'string' ? response : null);
    if (typeof response !== 'string') {
      deps.stdout(`      ${response.resolver} answered as ${response.family}: ${JSON.stringify(response.text.trim().slice(0, 80))}\n`);
      report('run leaves the tree unchanged', (await isTreeClean(cwd, deps.io, before)) ? null : 'files outside .workspace/ changed');
      if (response.handle) {
        const done = await call('finish', JSON.stringify(buildRequest('finish', { cwd, handle: response.handle, ok: true })));
        report('finish with the run\'s handle exits 0', exits(done, [0]));
      }
    }

    const started = await call('start', JSON.stringify(buildRequest('start', { cwd, name: NAME, prompt: 'Say hello and stop.' })));
    const answer = parsed('start', started);
    report('start answers with a handle or instructions', typeof answer === 'string' ? answer : null);
    if (typeof answer !== 'string') {
      deps.stdout(answer.handle
        ? `      it started ${answer.handle.kind} ${answer.handle.id}; close it when you are done\n`
        : `      it answered: ${answer.instructions}\n`);
    }
  }

  deps.stdout(failures === 0 ? 'The resolver keeps the contract.\n' : `${failures} check(s) failed.\n`);
  return failures === 0 ? 0 : 1;
}

// null when the call exited with one of codes, else why not.
function exits({ code, stderr }: Call, codes: number[]): string | null {
  if (code !== null && codes.includes(code)) return null;
  const said = stderr.trim() ? `: ${stderr.trim().split('\n').at(-1)}` : '';
  return code === null ? `it did not exit${said}` : `it exited ${code}, not ${codes.join(' or ')}${said}`;
}

function silent({ stdout }: Call): string | null {
  return stdout.trim() === '' ? null : `it printed ${JSON.stringify(stdout.trim().slice(0, 80))}`;
}

function checkProbe(result: Call): string | null {
  if (result.code === DECLINE) return silent(result);
  const response = parsed('probe', result);
  return typeof response === 'string' ? response : null;
}

// The response, or why it is not one.
function parsed<V extends Verb>(verb: V, result: Call): Responses[V] | string {
  if (result.code === DECLINE) return 'it declined; run the check where this resolver applies';
  const failure = exits(result, [0]);
  if (failure !== null) return failure;
  try {
    return parseResponse(verb, result.stdout);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    return error.message;
  }
}
