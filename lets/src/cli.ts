// The real entry: the commander program. Builds deps from the real world for
// a command, and exits with its code. Exits 2 on a usage error, such as an
// unknown flag or command.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import { run as handoff } from './delegate/handoff.ts';
import type { HandoffOptions } from './delegate/handoff.ts';
import { run as instructions } from './delegate/instructions.ts';
import { EFFORTS, FAMILIES, parseModel } from 'resolver-kit/protocol.ts';
import { run as review } from './delegate/review.ts';
import type { ReviewOptions } from './delegate/review.ts';
import { STRATEGIES } from './delegate/strategies.ts';
import type { Intent, Strategy } from './delegate/strategies.ts';
import { run as verify } from './delegate/verify.ts';
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
Each delegation has a strategy and an intent. The strategy is how the
session runs: review runs it read-only and waits for its answer, and
handoff starts an interactive session and returns at once. The intent is
what it is for: plan or code for a review, and apply for a handoff. Each
strategy has two commands: instructions says what can run and gives the
user's guidance, and run runs it.

A resolver turns each request into a real session. lets asks, in order:
the executable LETS_SPEC_RESOLVER names, then each resolver your delegate
config lists under resolvers. It stops at the first that does not
decline. Nothing on PATH is asked.

The config is $XDG_CONFIG_HOME/lets-delegate/config.yaml, or
~/.config/lets-delegate/config.yaml when XDG_CONFIG_HOME is unset. You
write it by hand:

  version: 2
  resolvers:
    - /absolute/path/to/lets-delegate-t3
    - subagent
  delegations:
    code:
      guidance: Prefer the strongest gpt model.

Each entry under resolvers is an absolute path, or subagent: the default,
lets-delegate-subagent, which ships with lets. With no config, only the
default is asked. The default starts no session: a review exits 3, and a
handoff gives back the prompt to carry on by hand.

delegations is optional. delegations.<intent>.guidance is prose that the
skill reads to rank the models; only instructions reads it.

Run lets delegate from the repo root.`;

const REVIEW_HELP = `
stdout: the session's final message.
stderr: one JSON line with resolver, family, model, independent, handle,
gitClean and durationSeconds. independent is true when the family that
answered is not the source family.

--model may be given more than once, best first. When the resolver
refuses a model, lets sends the next one to the same resolver.

Exit codes:
  0  the final message is on stdout
  2  usage error, or every resolver in the config declined
  3  no fresh session can run here on any model given: the harness or the
     account said no before the model gave any output. The harness is not
     running or not set up, there are no tokens left, it cannot run the
     model, or no resolver started a session. stderr names each model and
     why.
  4  the resolver broke the contract, or the outcome is unknown, such as
     no reply from the harness
  5  the session failed: an error, it stopped to ask, or an empty message
  6  the session did not finish in time
  7  the session changed files outside .workspace/`;

const HANDOFF_HELP = `
stdout: one JSON line, { resolver, handle }. When no session could be
started, handle is null and instructions holds the text to show the user.

--model may be given more than once, best first. When the resolver
refuses a model, lets sends the next one to the same resolver.

Exit codes:
  0  ok
  2  usage error, or every resolver in the config declined
  3  no fresh session can run here on any model given: the harness or the
     account said no. stderr names each model and why.
  4  the resolver broke the contract, or the outcome is unknown, such as
     no reply from the harness`;

const INSTRUCTIONS_HELP = `
stdout: one JSON line with strategy, for, resolver, options and guidance.
resolver and options come from the first resolver that does not decline a
probe for this strategy: options are the models it can run now, in its
order. guidance is delegations.<intent>.guidance from the config, or null.
It starts no session.

Exit codes:
  0  ok
  2  usage error, or every resolver in the config declined. A guidance
     that is not a string is a usage error.
  4  the resolver broke the contract`;

const VERIFY_HELP = `
It prints one line per check, and exits 1 if any fails.

The live part runs "Reply with the single word ready and stop" read-only
on each model probe lists, in order, until one is not refused (exit 3).
It checks the answer and the tree, and sends finish. A resolver that lists
no model gets no run. Then it starts a session with "Say hello and stop"
on the first model the probe for start lists, or on claude when it lists
none or does not answer, and leaves it for you to close.`;

// --timeout-minutes: a whole number of minutes.
function wholeMinutes(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new InvalidArgumentError('Give a whole number of minutes.');
  return Number(value);
}

// --model: <family> or <family>/<model>, passed to the resolver unchanged.
function modelString(value: string): string {
  if (parseModel(value) === null) throw new InvalidArgumentError(`Give <family> or <family>/<model>, for a family of ${FAMILIES.join(', ')}.`);
  return value;
}
// --model, given one or more times, best first.
const modelOption = () => new Option('--model <family[/model]>', 'a model to run, such as gpt/gpt-6-luna, or a bare family for the harness\'s default; repeat it to rank more, best first')
  .argParser((value: string, previous: string[] = []) => [...previous, modelString(value)]).makeOptionMandatory();

// --for: what the delegation is for, one of the strategy's intents.
const forOption = (strategy: Strategy) => new Option('--for <intent>', 'what the delegation is for')
  .choices(STRATEGIES[strategy].intents).makeOptionMandatory();

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
    nodePath: process.execPath,
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

// A strategy: a command that only holds instructions and run.
function strategyCommand(strategy: Strategy, summary: string) {
  const command = delegate.command(strategy).summary(summary).description(`${summary[0].toUpperCase()}${summary.slice(1)}.`);
  command
    .command('instructions')
    .summary('say what can run, and the user\'s guidance')
    .description('Ask the resolvers which models can run now, and give the user\'s guidance for the intent. Starts no session.')
    .addOption(forOption(strategy))
    .addHelpText('after', INSTRUCTIONS_HELP)
    .action(async ({ for: intent }: { for: Intent }) => {
      process.exitCode = await instructions({ strategy, for: intent }, realDeps());
    });
  return command;
}

strategyCommand('review', 'run a prompt in a fresh, read-only session and wait for its answer')
  .command('run')
  .summary('run the review')
  .description('Run a prompt in a fresh, read-only session on the first model --model names that is not refused, and wait for its final message.')
  .addOption(forOption('review'))
  .requiredOption('--name <name>', 'a label for the session, normalized to lowercase kebab-case')
  .requiredOption('--prompt-file <path>', 'the file that holds the prompt')
  .addOption(new Option('--source-family <family>', 'the model family that wrote the work').choices(FAMILIES).makeOptionMandatory())
  .addOption(new Option('--effort <effort>', 'how hard the session thinks').choices(EFFORTS).makeOptionMandatory())
  .addOption(modelOption())
  .option('--timeout-minutes <minutes>', 'how long to wait (default: 15, or 45 with --effort high)', wholeMinutes)
  .addHelpText('after', REVIEW_HELP)
  .action(async ({ model, ...options }: Omit<ReviewOptions, 'models'> & { model: string[] }) => {
    process.exitCode = await review({ ...options, models: model }, realDeps());
  });

strategyCommand('handoff', 'start a fresh, interactive session and return at once')
  .command('run')
  .summary('start the session')
  .description('Start a fresh, interactive session with a prompt, on the first model --model names that is not refused, and return at once.')
  .addOption(forOption('handoff'))
  .requiredOption('--name <name>', 'a label for the session, normalized to lowercase kebab-case')
  .requiredOption('--prompt-file <path>', 'the file that holds the prompt')
  .addOption(modelOption())
  .addHelpText('after', HANDOFF_HELP)
  .action(async ({ model, for: _intent, ...options }: Omit<HandoffOptions, 'models'> & { model: string[]; for: Intent }) => {
    process.exitCode = await handoff({ ...options, models: model }, realDeps());
  });

delegate
  .command('verify')
  .summary('check that a resolver keeps the contract')
  .description('Check that a resolver keeps the contract. The checks send requests that start nothing, unless you give --live.')
  .argument('<command...>', 'the resolver, and any arguments to give it before the verb')
  .option('--live', 'also run a session and start another: this spends tokens and may open a thread')
  .addHelpText('after', VERIFY_HELP)
  .action(async (command: string[], { live }: { live?: boolean }) => {
    process.exitCode = await verify({ command, live: live === true }, realDeps());
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (!(error instanceof CommanderError)) throw error;
  process.exitCode = error.exitCode === 0 ? 0 : 2;
}
