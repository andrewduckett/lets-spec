// The whole run: find the release, then the steps in order. No process access
// here; everything comes through deps, so tests run it with fakes.
import { isAbsolute, join, relative } from 'node:path';
import type { Deps, Io } from '../io.ts';
import { applyBlock, blockLines, blockState, LEGACY_LINKS, removeBlock, renderBlock, RULES, SKILLS, SKILLS_BODY } from './block.ts';
import { checkConfig } from './config.ts';
import { checkClaude, createInitFiles, linkClaude } from './init.ts';
import { isManaged } from './managed.ts';
import { AGENTS, defaultSchema, findRelease, openspecVersionWarning, requireRelease } from './release.ts';
import { checkSkills, syncSkills } from './skills.ts';

const CONFIG = 'openspec/config.yaml';
const GITIGNORE = '.gitignore';
const SKILLS_UNPAIRED = `${GITIGNORE} has a lets-spec skills marker without its pair, so its block was not updated. Delete the marker, and the lines between the markers, then run lets sync again.`;

export class UsageError extends Error {}

// check: change nothing, and exit 1 if the project is out of date.
export async function run({ check }: { check: boolean }, deps: Deps) {
  try {
    return await steps(check, deps);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.stderr(`error: ${error.message}\n`);
    return 1;
  }
}

// Whether git tracks the copied skills: LETS_SPEC_SKILLS, committed when
// unset or empty, as for LETS_SPEC_FLOW.
export function skillsMode(env: Deps['env']) {
  const mode = env.LETS_SPEC_SKILLS || 'committed';
  if (mode !== 'committed' && mode !== 'ignored') {
    throw new UsageError(`LETS_SPEC_SKILLS must be committed or ignored, got '${mode}'.`);
  }
  return mode;
}

async function steps(check: boolean, deps: Deps) {
  const { io } = deps;
  const release = findRelease(deps.env, deps.packageRoot, io);
  requireRelease(release, io);
  const schemaName = defaultSchema(release, io);

  const git = await io.execFile('git', ['rev-parse', '--show-toplevel'], { cwd: deps.cwd });
  if (git.code !== 0) {
    deps.stderr('lets-spec: not inside a git repo, so nothing was written.\n');
    return 0;
  }
  const root = git.stdout.trim();
  const mode = skillsMode(deps.env);

  const agentsPath = join(root, AGENTS);
  const rulesBlock = renderBlock(RULES, io.readFile(join(release, 'fragments', AGENTS))!);
  const gitignorePath = join(root, GITIGNORE);
  const skillsBlock = renderBlock(SKILLS, SKILLS_BODY);

  if (check) {
    const failures = checkRules(blockState(RULES, io.readFile(agentsPath), rulesBlock));
    const gitignoreState = blockState(SKILLS, io.readFile(gitignorePath), skillsBlock);
    if (mode === 'committed') {
      failures.push(...checkSkills({ release, schemaName, root, io }));
      if (gitignoreState === 'current' || gitignoreState === 'stale' || gitignoreState === 'unpaired') {
        failures.push(`lets-spec: ${GITIGNORE} still has the lets-spec skills block. Run lets sync, then commit ${GITIGNORE}.`);
      }
    } else if (gitignoreState !== 'current') {
      failures.push(`lets-spec: ${GITIGNORE} has no current lets-spec skills block. Run lets sync, then commit ${GITIGNORE}.`);
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
    io.writeFile(agentsPath, rules.text!);
  }
  if (rules.state === 'absent') say(`lets-spec: created ${AGENTS}.\n`);
  if (rules.state === 'missing') say(`lets-spec: added the lets-spec rules to ${AGENTS}. Commit it.\n`);
  if (rules.state === 'stale') say(`lets-spec: updated the lets-spec rules in ${AGENTS}. Commit it.\n`);
  if (rules.state === 'unpaired') {
    warnings.push(`${AGENTS} has a lets-spec rules marker without its pair, so its rules were not updated. Delete the marker, and the rules text with it, then run lets sync again.`);
  }

  createInitFiles({ release, root, io, stdout: say });
  linkClaude({ root, io, stdout: say });

  const exclude = await excludePath(root, io);
  if (exclude !== null) warnings.push(...removeLegacyLinks({ root, exclude, io, stdout: say }));

  syncSkills({ release, schemaName, root, mode, io, stdout: say });

  if (mode === 'ignored') {
    const ignored = applyBlock(SKILLS, io.readFile(gitignorePath), skillsBlock);
    if (ignored.state === 'absent' || ignored.state === 'missing') {
      io.writeFile(gitignorePath, ignored.text!);
      say(`lets-spec: added the lets-spec skills block to ${GITIGNORE}. Run: git rm -r --cached .agents/skills/lets-* .agents/skills/openspec-* openspec/schemas/lets-*, then commit.\n`);
    }
    if (ignored.state === 'stale') {
      io.writeFile(gitignorePath, ignored.text!);
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
function checkRules(state: string) {
  switch (state) {
    case 'absent':
    case 'missing':
      return [`lets-spec: ${AGENTS} has no lets-spec rules. Run lets sync, then commit ${AGENTS}.`];
    case 'stale':
      return [`lets-spec: ${AGENTS}'s lets-spec rules are out of date. Run lets sync, then commit ${AGENTS}.`];
    case 'unpaired':
      return [`lets-spec: ${AGENTS} has a lets-spec rules marker without its pair.`];
    default:
      return [];
  }
}

// The bash lets-sync's test for a link it made: the target holds the name
// of a release's store path.
const LEGACY_RELEASE = '-lets-spec-release/';

// Older releases linked the skills and the schema, some under names from
// before the rename, and listed each link in a section of .git/info/exclude.
// Remove each listed link into a release, never following it, then the
// section, so git sees the copies. syncSkills replaces the links at managed
// paths. Returns the warnings.
function removeLegacyLinks({ root, exclude, io, stdout }: { root: string; exclude: string; io: Io; stdout: (text: string) => void }) {
  const text = io.readFile(exclude);
  if (blockState(LEGACY_LINKS, text, '') === 'unpaired') {
    const shown = relative(root, exclude).startsWith('..') ? exclude : relative(root, exclude);
    return [`${shown} has a lets-spec links marker without its pair, so its old links were not removed. Delete the marker, and the lines between the markers, then run lets sync again.`];
  }
  const listed = blockLines(LEGACY_LINKS, text);
  if (listed === null) return [];
  for (const line of listed) {
    if (!line.startsWith('/')) continue;
    const path = line.slice(1);
    if (isManaged(path)) continue;
    const full = join(root, path);
    if (io.isSymlink(full) && (io.readlink(full) ?? '').includes(LEGACY_RELEASE)) {
      io.remove(full);
      stdout(`lets-spec: removed ${path}.\n`);
    }
  }
  io.writeFile(exclude, removeBlock(LEGACY_LINKS, text).text ?? '');
  return [];
}

// Where git keeps the project's exclude file, or null when git cannot say.
async function excludePath(root: string, io: Io) {
  const result = await io.execFile('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root });
  if (result.code !== 0) return null;
  const path = result.stdout.trim();
  return isAbsolute(path) ? path : join(root, path);
}
