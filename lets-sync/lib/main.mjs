// The whole run: parse, find the release, then the steps in order. No process
// access here; everything comes through deps, so tests run it with fakes.
import { findRelease, releaseSchema, requireRelease } from './release.mjs';

export class UsageError extends Error {}

export const USAGE = `lets-sync: set up a project for lets-spec, and keep it set up. The dev
shell runs it each time it starts, and it is safe to run any number of
times.

Usage: lets-sync [--check]

Keeps the lets-spec rules in a marked block of AGENTS.md: creates
AGENTS.md with only the block when it is missing, appends the block when
AGENTS.md lacks it, and rewrites the block when it is out of date. The
project owns the rest of the file, and commits the block with it.

Creates each other file the project owns when it is missing:
openspec/config.yaml from the release's template, and the CLAUDE.md and
.claude/skills links. It never edits one that exists, and names each file
it creates or changes.

Copies each skill into .agents/skills, and the schema into openspec/schemas.
With LETS_SPEC_SKILLS=committed, the default, the project commits them.
With LETS_SPEC_SKILLS=ignored, lets-sync keeps a block in .gitignore that
ignores them.

Then it warns if:
- the rules block in AGENTS.md has a marker without its pair
- openspec/config.yaml is invalid, or names a schema other than the release's
- CLAUDE.md is not a link to AGENTS.md, or .claude/skills is not a link to
  ../.agents/skills

It prints nothing when all is well, and exits 0 even when it warns, so a
problem never stops the shell from starting.

With --check, it changes nothing, and exits 1 if the rules block in
AGENTS.md is missing or out of date. Run it in CI.

WORKFLOW_RELEASE names the release. The Nix wrapper sets it.
`;

// deps: { env, cwd, packageRoot, io, stdout(text), stderr(text) }
export async function run(argv, deps) {
  const { io } = deps;
  let check;
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      deps.stdout(USAGE);
      return 0;
    }
    check = parsed.check;
    const release = findRelease(deps.env, deps.packageRoot);
    requireRelease(release, io);
    releaseSchema(release, io);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.stderr(`error: ${error.message}\n`);
    return 1;
  }

  const git = await io.execFile('git', ['rev-parse', '--show-toplevel'], { cwd: deps.cwd });
  if (git.code !== 0) {
    deps.stderr('lets-spec: not inside a git repo, so nothing was written.\n');
    return 0;
  }

  void check;
  return 0;
}

// Like the bash case: only the first argument counts.
function parseArgs(argv) {
  switch (argv[0] ?? '') {
    case '':
      return { check: false, help: false };
    case '--check':
      return { check: true, help: false };
    case '-h':
    case '--help':
      return { check: false, help: true };
    default:
      throw new UsageError(`unknown option ${argv[0]}. Usage: lets-sync [--check]`);
  }
}
