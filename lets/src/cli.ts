// The real entry: the commander program. Builds deps from the real world for
// a command, and exits with its code. Exits 2 on a usage error, such as an
// unknown flag or command.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';
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

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (!(error instanceof CommanderError)) throw error;
  process.exitCode = error.exitCode === 0 ? 0 : 2;
}
