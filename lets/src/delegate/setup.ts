// lets delegate setup: find out what this machine can run, propose a
// delegate config from that, and write it on request. It starts no session
// and spends no tokens: it runs only the CLIs' model list commands and looks
// on PATH. No process access here; everything comes through deps.
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import type { Child, Deps, Io } from '../io.ts';
import { CONFIG_VERSION, configPath, readConfig } from './config.ts';
import type { Config } from './config.ts';
import type { Env } from './env.ts';
import { EXIT, exitCodeOf, UsageError } from './errors.ts';
import { FAMILIES } from './protocol.ts';
import type { Family } from './protocol.ts';
import { withTimeout } from './wait.ts';

export const HARNESSES = ['t3', 'herdr'] as const;
// The CLI that runs each family.
export const FAMILY_CLI: Record<Family, string> = { gpt: 'codex', claude: 'claude', gemini: 'agy' };
// How long a model list command may take.
export const LIST_TIMEOUT_MS = 30_000;

export type Harness = { name: (typeof HARNESSES)[number] | 'none'; onPath: Record<(typeof HARNESSES)[number], boolean> };
// models: what the account can run, best first; [] when there is no list.
// error: why the list command failed, when it did.
export type FamilyFindings = { cli: string; available: boolean; models: string[]; error?: string };
// resolver: the path of lets-delegate-resolver on PATH, or null.
export type Findings = { harness: Harness; families: Record<Family, FamilyFindings>; resolver: string | null };

export type DetectDeps = { env: Env; io: Io };

// What this machine offers: the harness this process runs in, and each
// family's CLI.
export async function detect({ env, io }: DetectDeps): Promise<Findings> {
  const onPath = { t3: io.commandExists('t3'), herdr: io.commandExists('herdr') };
  const name = insideT3(env, io) ? 't3' : env.HERDR_ENV === '1' && onPath.herdr ? 'herdr' : 'none';
  const families = {} as Record<Family, FamilyFindings>;
  for (const family of FAMILIES) {
    const cli = FAMILY_CLI[family];
    families[family] = { cli, available: io.commandExists(cli), models: [] };
    const list = LISTS[family];
    if (families[family].available && list !== null) Object.assign(families[family], await listModels(io, cli, list));
  }
  return { harness: { name, onPath }, families, resolver: resolverOnPath(env, io) };
}

// The flags that change the proposal. order: comma-separated families.
// model: family=model, any number of times. resolver: a path, or none.
export type ProposeFlags = { order?: string; model?: string[]; resolver?: string };
export type SetupOptions = ProposeFlags & { json?: boolean; write?: boolean };

// The exit code: 0 ok, 2 usage.
export async function run(options: SetupOptions, deps: Deps): Promise<number> {
  try {
    return await setup(options, deps);
  } catch (error) {
    const code = exitCodeOf(error);
    if (code === null) throw error;
    deps.stderr(`lets delegate: ${(error as Error).message}\n`);
    return code;
  }
}

async function setup(options: SetupOptions, deps: Deps): Promise<number> {
  // A bad flag stops setup before it runs any list command.
  parseFlags(options);
  const findings = await detect(deps);
  const proposed = propose(findings, options);
  const path = configPath(deps);
  let current: Config | null = null;
  try {
    current = readConfig(deps);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.stderr(`lets delegate: the current config cannot be read: ${error.message}\n`);
  }

  if (options.json) deps.stdout(`${JSON.stringify({ harness: findings.harness, families: findings.families, current, proposed })}\n`);
  else deps.stdout(report(findings, current, proposed));

  if (options.write) {
    deps.io.mkdirp(dirname(path));
    deps.io.writeFile(path, `${JSON.stringify(proposed, null, 2)}\n`);
    (options.json ? deps.stderr : deps.stdout)(`Wrote ${path}\n`);
  } else if (!options.json) {
    deps.stdout(`\nNothing was written. Run again with --write to write ${path}.\n`);
  }
  return EXIT.ok;
}

// The findings, the current config and the proposal, as text for a person.
function report({ harness, families }: Findings, current: Config | null, proposed: Config): string {
  const yesNo = (found: boolean) => (found ? 'on PATH' : 'not on PATH');
  const lines = [
    `Harness: ${harness.name} (t3 ${yesNo(harness.onPath.t3)}, herdr ${yesNo(harness.onPath.herdr)})`,
    '',
    'Families',
  ];
  for (const family of FAMILIES) {
    const { cli, available, models, error } = families[family];
    const list = LISTS[family];
    let detail = `${cli} ${yesNo(available)}`;
    if (available && list === null) detail += '; no model list, so the CLI\'s default runs';
    else if (available && error !== undefined) detail += `; no model list: ${error}`;
    else if (available) detail += `; models from \`${[cli, ...list!.args].join(' ')}\`: ${models.join(', ')}`;
    lines.push(`  ${family}: ${detail}`);
  }
  lines.push('', 'Current', ...(current === null ? ['  none'] : describe(current)), '', 'Proposed', ...describe(proposed));
  return `${lines.join('\n')}\n`;
}

function describe({ resolver, reviewers }: Config): string[] {
  const efforts = (list?: string[]) => (list === undefined ? '' : ` (efforts: ${list.join(', ')})`);
  return [
    `  resolver: ${resolver ?? 'none, so the default, lets-delegate-subagent, answers'}`,
    '  reviewers, in order:',
    ...(reviewers.length === 0 ? ['    none'] : reviewers.map(({ family, model, efforts: e }) => `    ${family} ${model ?? '(CLI default)'}${efforts(e)}`)),
  ];
}

// The flags, checked on their own: each family they name is known, and
// each value has its form. Throws a UsageError that names what is wrong.
function parseFlags(flags: ProposeFlags): { order?: Family[]; models: [Family, string][] } {
  const known = (family: string, flag: string): Family => {
    if (!(FAMILIES as readonly string[]).includes(family)) throw new UsageError(`${flag} names ${family}, which is not one of ${FAMILIES.join(', ')}`);
    return family as Family;
  };
  const order = flags.order?.split(',').map((family) => known(family.trim(), '--order'));
  const models = (flags.model ?? []).map((pair): [Family, string] => {
    const match = pair.match(/^([^=]+)=(.+)$/);
    if (!match) throw new UsageError(`--model must be <family>=<model>, got ${pair}`);
    return [known(match[1], '--model'), match[2]];
  });
  if (flags.resolver !== undefined && flags.resolver !== 'none' && !isAbsolute(flags.resolver)) {
    throw new UsageError(`--resolver must be an absolute path or none, got ${flags.resolver}`);
  }
  const twice = (families: Family[], flag: string) => {
    const repeated = families.find((family, i) => families.indexOf(family) !== i);
    if (repeated !== undefined) throw new UsageError(`${flag} names ${repeated} twice`);
  };
  twice(order ?? [], '--order');
  twice(models.map(([family]) => family), '--model');
  return { order, models };
}

// The config setup proposes: one reviewer per available family, in FAMILIES
// order, with the first model the account lists, else the CLI's default.
// The resolver is the one on PATH when a harness it serves is installed.
// Throws a UsageError that names a flag's unknown or unavailable family.
export function propose({ harness, families, resolver }: Findings, flags: ProposeFlags): Config {
  const parsed = parseFlags(flags);
  const available = (family: Family, flag: string) => {
    if (!families[family].available) throw new UsageError(`${flag} names ${family}, which is not available here: ${families[family].cli} is not on PATH`);
    return family;
  };
  const order = parsed.order?.map((family) => available(family, '--order')) ?? FAMILIES.filter((family) => families[family].available);
  const models = new Map<Family, string>();
  for (const [family, model] of parsed.models) {
    available(family, '--model');
    if (!order.includes(family)) throw new UsageError(`--model names ${family}, which --order leaves out`);
    models.set(family, model);
  }
  const harnessInstalled = harness.onPath.t3 || harness.onPath.herdr;
  return {
    version: CONFIG_VERSION,
    resolver: flags.resolver === undefined ? (harnessInstalled ? resolver : null) : flags.resolver === 'none' ? null : flags.resolver,
    reviewers: order.map((family) => ({ family, model: models.get(family) ?? families[family].models[0] ?? null })),
  };
}

// True when the T3 server in T3's runtime file is alive and one of this
// process's parents. The contrib resolver checks the same way, so setup
// works before any resolver is installed.
function insideT3(env: Env, io: Io): boolean {
  const base = env.T3CODE_HOME ?? `${io.homedir()}/.t3`;
  const text = io.readFile(`${base}/userdata/server-runtime.json`);
  if (text === null) return false;
  let pid: unknown;
  try {
    ({ pid } = JSON.parse(text));
  } catch {
    return false;
  }
  if (typeof pid !== 'number' || !io.processAlive(pid)) return false;
  let current: number | null = io.pid;
  // The bound guards against a cycle in a bad parent map.
  for (let hops = 0; current !== null && current > 0 && hops < 4096; hops++) {
    if (current === pid) return true;
    current = io.parentPid(current);
  }
  return false;
}

// How each family's account lists its models: the command, and how to read
// what it prints. claude has no list, so its CLI's default runs.
type List = { args: string[]; parse: (stdout: string) => string[] };
const LISTS: Record<Family, List | null> = {
  gpt: { args: ['debug', 'models'], parse: codexModels },
  claude: null,
  gemini: { args: ['models'], parse: agyModels },
};

// Run a list command. A command that fails, times out or prints what does not
// parse gives no models, and an error that says why.
async function listModels(io: Io, cli: string, { args, parse }: List): Promise<{ models: string[]; error?: string }> {
  const command = [cli, ...args].join(' ');
  const started: { child?: Child } = {};
  const result = await withTimeout(io, io.execFile(cli, args, { started: (child) => { started.child = child; } }), LIST_TIMEOUT_MS);
  if (result === null) {
    started.child?.kill();
    return { models: [], error: `${command} did not answer in ${LIST_TIMEOUT_MS / 1000} seconds` };
  }
  if (result.code !== 0) return { models: [], error: `${command} exited ${result.code}: ${result.stderr.trim()}` };
  try {
    const models = parse(result.stdout);
    if (models.length === 0) throw new Error('no models');
    return { models };
  } catch {
    return { models: [], error: `could not read the models in what ${command} printed` };
  }
}

// The slug of each model codex lists for the account, in its order.
export function codexModels(stdout: string): string[] {
  const { models } = JSON.parse(stdout) as { models: { slug?: unknown; visibility?: unknown }[] };
  return models.filter((m) => m.visibility === 'list' && typeof m.slug === 'string').map((m) => m.slug as string);
}

// Each gemini model agy lists, once, without its effort suffix: agy lists a
// model once per effort, and the resolver adds the effort back.
export function agyModels(stdout: string): string[] {
  const ids = stdout.split('\n').map((line) => line.split(/\s/)[0]).filter((id) => id.startsWith('gemini-'));
  return [...new Set(ids.map((id) => id.replace(/-(low|medium|high)$/, '')))];
}

// The path of the lets-delegate-resolver that PATH finds first, or null.
function resolverOnPath(env: Env, io: Io): string | null {
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (dir !== '' && io.isExecutable(join(dir, 'lets-delegate-resolver'))) return join(dir, 'lets-delegate-resolver');
  }
  return null;
}
