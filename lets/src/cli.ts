// The real entry: the commander program. Builds deps from the real world for
// a command, and exits with its code. Exits 2 on a usage error, such as an
// unknown flag or command.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import { run as conformance } from './delegate/conformance.ts';
import { run as handoff } from './delegate/handoff.ts';
import type { HandoffOptions } from './delegate/handoff.ts';
import { EFFORTS, FAMILIES } from './delegate/protocol.ts';
import { run as review } from './delegate/review.ts';
import { run as setup } from './delegate/setup.ts';
import type { SetupOptions } from './delegate/setup.ts';
import type { ReviewOptions } from './delegate/review.ts';
import { realIo } from './io.ts';
import type { Deps } from './io.ts';
import { run as sync } from './sync/main.ts';

// The folder above the one that holds this file: lets/ in the repo, and the
// release folder once bundled into bin/lets.
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

const SYNC_HELP = `
Keeps the lets-spec rules in a marked block of AGENTS.md: creates
AGENTS.md with only the block when it is missing, appends the block when
AGENTS.md lacks it, and rewrites the block when it is out of date. The
project owns the rest of the file, and commits the block with it.

Creates each other file the project owns when it is missing:
openspec/config.yaml from the release's template, and the CLAUDE.md and
.claude/skills links. It never edits one that exists, and names each file
it creates or changes.

Copies each skill into .agents/skills, and each schema into openspec/schemas.
With LETS_SPEC_SKILLS=committed, the default, the project commits them.
With LETS_SPEC_SKILLS=ignored, lets sync keeps a block in .gitignore that
ignores them.

Then it warns if:
- the rules block in AGENTS.md has a marker without its pair
- openspec/config.yaml is invalid, or names a schema other than the release's
  default
- CLAUDE.md is not a link to AGENTS.md, or .claude/skills is not a link to
  ../.agents/skills

It prints nothing when all is well, and exits 0 even when it warns, so a
problem never stops the shell from starting.

With --check, it changes nothing, and exits 1 if the rules block in
AGENTS.md is missing or out of date. With LETS_SPEC_SKILLS=committed, it
also exits 1 if a copied skill differs from the release, or .gitignore
still has the skills block. With LETS_SPEC_SKILLS=ignored, it exits 1 if
.gitignore lacks a current skills block. Run it in CI.

WORKFLOW_RELEASE names the release folder. Without it, LETS_SPEC_FLOW
(default standard) picks one of the releases that ship with lets.
The Nix wrapper sets WORKFLOW_RELEASE.`;

const DELEGATE_HELP = `
A resolver turns each request into a real session. lets asks, in order:
the executable LETS_SPEC_RESOLVER names, the resolver your delegate config
names, lets-delegate-resolver on PATH, then the built-in default. The first
that does not decline answers. The default starts no session: a review
exits 3, and a handoff gives back the prompt to carry on by hand.

Run lets delegate setup once per machine. It finds what your machine can
run, and proposes the config: which resolver to ask, and which families and
models a review may use.

Run lets delegate from the repo root.`;

const REVIEW_HELP = `
stdout: the session's final message.
stderr: one JSON line with resolver, family, model, independent, handle,
gitClean and durationSeconds. independent is true when the family that
answered is not the source family.

Exit codes:
  0  the final message is on stdout
  2  usage error
  3  no fresh session can run here: no resolver started one, or none of
     its families is available
  4  the harness refused the session, or the resolver broke the contract
  5  the session failed: an error, it stopped to ask, or an empty message
  6  the session did not finish in time
  7  the session changed files outside .workspace/`;

const HANDOFF_HELP = `
stdout: one JSON line, { resolver, handle }. When no session could be
started, handle is null and instructions holds the text to show the user.

Exit codes: 0 ok, 2 usage error, 4 the session could not start.`;

const SETUP_HELP = `
It starts no session and spends no tokens. It looks on PATH for t3, herdr,
lets-delegate-resolver, and each family's CLI: codex (gpt), claude and agy
(gemini). It asks codex and agy which models the account can run, with
\`codex debug models\` and \`agy models\`. claude has no list, so its CLI's
default runs.

The proposal has one reviewer per available family, in the order gpt,
claude, gemini, each with the first model its account lists. Its resolver
is lets-delegate-resolver on PATH when t3 or herdr is installed; else none,
and the built-in default answers.

Nothing is written without --write. The config is
$XDG_CONFIG_HOME/lets-delegate/config.json, or
~/.config/lets-delegate/config.json when XDG_CONFIG_HOME is unset.
--write replaces it. To limit a reviewer to some efforts, add
"efforts": ["low", "medium", "high"] to its entry by hand.

Exit codes: 0 ok, 2 usage error.`;

const CONFORMANCE_HELP = `
It prints one line per check, and exits 1 if any fails.

The live part runs "Reply with the single word ready and stop" read-only,
checks the answer and the tree, and sends finish. Then it starts a session
with "Say hello and stop", and leaves it for you to close.`;

// --timeout-minutes: a whole number of minutes.
function wholeMinutes(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new InvalidArgumentError('Give a whole number of minutes.');
  return Number(value);
}

// The release's version from its release.json, else 0.0.0-dev.
function version(): string {
  try {
    const release = JSON.parse(readFileSync(join(packageRoot, 'release.json'), 'utf8'));
    return typeof release.version === 'string' ? release.version : '0.0.0-dev';
  } catch {
    return '0.0.0-dev';
  }
}

function realDeps(): Deps {
  return {
    env: process.env,
    cwd: process.cwd(),
    packageRoot,
    io: realIo(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
}

const program = new Command()
  .name('lets')
  .description('The lets-spec command.')
  .version(version())
  .exitOverride();

program
  .command('sync')
  .usage('[--check]')
  .summary('set up a project for lets-spec, and keep it set up')
  .description('Set up a project for lets-spec, and keep it set up. The dev shell runs it each time it starts, and it is safe to run any number of times.')
  .option('--check', 'change nothing, and exit 1 if the project is out of date')
  .addHelpText('after', SYNC_HELP)
  .action(async ({ check }: { check?: boolean }) => {
    process.exitCode = await sync({ check: check === true }, realDeps());
  });

const delegate = program
  .command('delegate')
  .summary('run a prompt in a fresh session, through a resolver')
  .description('Run a prompt in a fresh session. A resolver makes the session; lets checks the result.')
  .addHelpText('after', DELEGATE_HELP);

delegate
  .command('review')
  .summary('run a prompt in a fresh, read-only session and wait for its answer')
  .description('Run a prompt in a fresh, read-only session, and wait for its final message. The resolver picks the model family.')
  .requiredOption('--name <name>', 'a label for the session, normalized to lowercase kebab-case')
  .requiredOption('--prompt-file <path>', 'the file that holds the prompt')
  .addOption(new Option('--source-family <family>', 'the model family that wrote the work').choices(FAMILIES).makeOptionMandatory())
  .addOption(new Option('--effort <effort>', 'how hard the session thinks').choices(EFFORTS).makeOptionMandatory())
  .option('--timeout-minutes <minutes>', 'how long to wait (default: 15, or 45 with --effort high)', wholeMinutes)
  .addHelpText('after', REVIEW_HELP)
  .action(async (options: ReviewOptions) => {
    process.exitCode = await review(options, realDeps());
  });

delegate
  .command('handoff')
  .summary('start a fresh, interactive session and return at once')
  .description('Start a fresh, interactive session with a prompt, and return at once.')
  .requiredOption('--name <name>', 'a label for the session, normalized to lowercase kebab-case')
  .requiredOption('--prompt-file <path>', 'the file that holds the prompt')
  .addHelpText('after', HANDOFF_HELP)
  .action(async (options: HandoffOptions) => {
    process.exitCode = await handoff(options, realDeps());
  });

delegate
  .command('setup')
  .summary('find what this machine can run, and propose a delegate config')
  .description('Find the harness, the family CLIs and the models each account can run, and propose a delegate config. Writes it only with --write.')
  .option('--write', 'write the proposed config, replacing the current one')
  .option('--json', 'print the findings, the current config and the proposal as one JSON object')
  .option('--order <families>', 'the reviewers, in order, comma-separated; a family left out is dropped')
  .option('--model <family=model>', 'the model for one family; give it once per family', (value: string, list: string[] = []) => [...list, value])
  .option('--resolver <path|none>', 'the resolver to name, or none for the built-in default')
  .addHelpText('after', SETUP_HELP)
  .action(async (options: SetupOptions) => {
    process.exitCode = await setup(options, realDeps());
  });

delegate
  .command('conformance')
  .summary('check that a resolver keeps the contract')
  .description('Check that a resolver keeps the contract. The checks send requests that start nothing, unless you give --live.')
  .argument('<command...>', 'the resolver, and any arguments to give it before the verb')
  .option('--live', 'also run a session and start another: this spends tokens and may open a thread')
  .addHelpText('after', CONFORMANCE_HELP)
  .action(async (command: string[], { live }: { live?: boolean }) => {
    process.exitCode = await conformance({ command, live: live === true }, realDeps());
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (!(error instanceof CommanderError)) throw error;
  process.exitCode = error.exitCode === 0 ? 0 : 2;
}
