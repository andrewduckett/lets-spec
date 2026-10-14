// The whole run: parse, find the release, then the steps in order. No process
// access here; everything comes through deps, so tests run it with fakes.
import { isAbsolute, join } from 'node:path';
import { applyBlock, blockState, LEGACY_LINKS, removeBlock, renderBlock, RULES, SKILLS, SKILLS_BODY } from './block.mjs';
import { checkConfig } from './config.mjs';
import { checkClaude, createInitFiles, linkClaude } from './init.mjs';
import { AGENTS, findRelease, openspecVersionWarning, releaseSchema, requireRelease } from './release.mjs';
import { checkSkills, syncSkills } from './skills.mjs';

const CONFIG = 'openspec/config.yaml';
const GITIGNORE = '.gitignore';
const SKILLS_UNPAIRED = `${GITIGNORE} has a lets-spec skills marker without its pair, so its block was not updated. Delete the marker, and the lines between the markers, then run lets-sync again.`;

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
AGENTS.md is missing or out of date. With LETS_SPEC_SKILLS=committed, it
also exits 1 if a copied skill differs from the release, or .gitignore
still has the skills block. With LETS_SPEC_SKILLS=ignored, it exits 1 if
.gitignore lacks a current skills block. Run it in CI.

WORKFLOW_RELEASE names the release folder. Without it, LETS_SPEC_FLOW
(default standard) and LETS_SPEC_BACKLOG (default github-labels) pick one
of the releases that ship with lets-sync. The Nix wrapper sets
WORKFLOW_RELEASE.
`;

// deps: { env, cwd, packageRoot, io, stdout(text), stderr(text) }
export async function run(argv, deps) {
  try {
    return await steps(argv, deps);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.stderr(`error: ${error.message}\n`);
    return 1;
  }
}

// Whether git tracks the copied skills: LETS_SPEC_SKILLS, committed by default.
export function skillsMode(env) {
  const mode = env.LETS_SPEC_SKILLS ?? 'committed';
  if (mode !== 'committed' && mode !== 'ignored') {
    throw new UsageError(`LETS_SPEC_SKILLS must be committed or ignored, got '${mode}'.`);
  }
  return mode;
}

async function steps(argv, deps) {
  const { io } = deps;
  const parsed = parseArgs(argv);
  if (parsed.help) {
    deps.stdout(USAGE);
    return 0;
  }
  const release = findRelease(deps.env, deps.packageRoot, io);
  requireRelease(release, io);
  const schemaName = releaseSchema(release, io);

  const git = await io.execFile('git', ['rev-parse', '--show-toplevel'], { cwd: deps.cwd });
  if (git.code !== 0) {
    deps.stderr('lets-spec: not inside a git repo, so nothing was written.\n');
    return 0;
  }
  const root = git.stdout.trim();
  const mode = skillsMode(deps.env);

  const agentsPath = join(root, AGENTS);
  const rulesBlock = renderBlock(RULES, io.readFile(join(release, 'fragments', AGENTS)));
  const gitignorePath = join(root, GITIGNORE);
  const skillsBlock = renderBlock(SKILLS, SKILLS_BODY);

  if (parsed.check) {
    const failures = checkRules(blockState(RULES, io.readFile(agentsPath), rulesBlock));
    const gitignoreState = blockState(SKILLS, io.readFile(gitignorePath), skillsBlock);
    if (mode === 'committed') {
      failures.push(...checkSkills({ release, schemaName, root, io }));
      if (gitignoreState === 'current' || gitignoreState === 'stale' || gitignoreState === 'unpaired') {
        failures.push(`lets-spec: ${GITIGNORE} still has the lets-spec skills block. Run lets-sync, then commit ${GITIGNORE}.`);
      }
    } else if (gitignoreState !== 'current') {
      failures.push(`lets-spec: ${GITIGNORE} has no current lets-spec skills block. Run lets-sync, then commit ${GITIGNORE}.`);
    }
    for (const line of failures) deps.stderr(`${line}\n`);
    return failures.length > 0 ? 1 : 0;
  }

  const warnings = [];
  const say = deps.stdout;

  // Keep the rules block in AGENTS.md. writeFile writes through the file, so
  // a link or the file's permissions are kept.
  const rules = applyBlock(RULES, io.readFile(agentsPath), rulesBlock);
  if (rules.state === 'absent' || rules.state === 'missing' || rules.state === 'stale') {
    io.writeFile(agentsPath, rules.text);
  }
  if (rules.state === 'absent') say(`lets-spec: created ${AGENTS}.\n`);
  if (rules.state === 'missing') say(`lets-spec: added the lets-spec rules to ${AGENTS}. Commit it.\n`);
  if (rules.state === 'stale') say(`lets-spec: updated the lets-spec rules in ${AGENTS}. Commit it.\n`);
  if (rules.state === 'unpaired') {
    warnings.push(`${AGENTS} has a lets-spec rules marker without its pair, so its rules were not updated. Delete the marker, and the rules text with it, then run lets-sync again.`);
  }

  createInitFiles({ release, root, io, stdout: say });
  linkClaude({ root, io, stdout: say });

  // Older releases linked the skills and listed the links in a section of
  // .git/info/exclude. Remove the section, so git sees the copies.
  const exclude = await excludePath(root, io);
  if (exclude !== null) {
    const legacy = removeBlock(LEGACY_LINKS, io.readFile(exclude));
    if (legacy.removed) io.writeFile(exclude, legacy.text ?? '');
  }

  syncSkills({ release, schemaName, root, io, stdout: say });

  if (mode === 'ignored') {
    const ignored = applyBlock(SKILLS, io.readFile(gitignorePath), skillsBlock);
    if (ignored.state === 'absent' || ignored.state === 'missing') {
      io.writeFile(gitignorePath, ignored.text);
      say(`lets-spec: added the lets-spec skills block to ${GITIGNORE}. Run: git rm -r --cached .agents/skills/lets-* .agents/skills/openspec-* openspec/schemas/lets-*, then commit.\n`);
    }
    if (ignored.state === 'stale') {
      io.writeFile(gitignorePath, ignored.text);
      say(`lets-spec: updated the lets-spec skills block in ${GITIGNORE}. Commit it.\n`);
    }
    if (ignored.state === 'unpaired') {
      warnings.push(SKILLS_UNPAIRED);
    }
  } else {
    const gitignore = io.readFile(gitignorePath);
    const kept = removeBlock(SKILLS, gitignore);
    if (blockState(SKILLS, gitignore, skillsBlock) === 'unpaired') warnings.push(SKILLS_UNPAIRED);
    if (kept.removed) {
      io.writeFile(gitignorePath, kept.text ?? '');
      say(`lets-spec: removed the lets-spec skills block from ${GITIGNORE}. Run: git add .agents/skills openspec/schemas, then commit.\n`);
    }
  }

  warnings.push(...checkClaude({ root, io }));
  warnings.push(...checkConfig({ io, configPath: join(root, CONFIG), schemaName }).map((line) => line.replace(join(root, CONFIG), CONFIG)));
  const versionWarning = await openspecVersionWarning({ release, io });
  if (versionWarning !== null) warnings.push(versionWarning);

  if (warnings.length > 0) {
    deps.stderr(`lets-spec: ${warnings.length} problem(s) to fix:\n${warnings.map((line) => `- ${line}\n`).join('')}`);
  }
  return 0;
}

// The --check failure for each state of the rules block.
function checkRules(state) {
  switch (state) {
    case 'absent':
    case 'missing':
      return [`lets-spec: ${AGENTS} has no lets-spec rules. Run lets-sync, then commit ${AGENTS}.`];
    case 'stale':
      return [`lets-spec: ${AGENTS}'s lets-spec rules are out of date. Run lets-sync, then commit ${AGENTS}.`];
    case 'unpaired':
      return [`lets-spec: ${AGENTS} has a lets-spec rules marker without its pair.`];
    default:
      return [];
  }
}

// Where git keeps the project's exclude file, or null when git cannot say.
async function excludePath(root, io) {
  const result = await io.execFile('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root });
  if (result.code !== 0) return null;
  const path = result.stdout.trim();
  return isAbsolute(path) ? path : join(root, path);
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
