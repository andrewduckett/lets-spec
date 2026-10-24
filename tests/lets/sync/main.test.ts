import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, skillsMode } from '../../../lets/src/sync/main.ts';
import type { Deps } from '../../../lets/src/io.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const RELEASE = '/store/abc-lets-spec-release';

// A release the validators accept: one skill, one schema, init and fragments.
const releaseFiles = {
  [`${RELEASE}/overlay/.agents/skills/lets-build/SKILL.md`]: 'skill',
  [`${RELEASE}/overlay/openspec/schemas/lets-standard/schema.yaml`]: 'schema',
  [`${RELEASE}/init/openspec/config.yaml`]: 'schema: lets-standard\n',
  [`${RELEASE}/fragments/AGENTS.md`]: 'rules\n',
};

type Setup = { env?: Record<string, string>; files?: Record<string, string>; toplevel?: string | null };

function setup({ env = { WORKFLOW_RELEASE: RELEASE }, files = releaseFiles, toplevel = null }: Setup = {}) {
  const io = fakeIo({ files, toplevel });
  const out: string[] = [];
  const err: string[] = [];
  const deps = {
    env, cwd: '/project', packageRoot: '/pkg', nodePath: process.execPath, io,
    // sync asks no resolver.
    resolvers: {} as Deps['resolvers'],
    stdout: (text: string) => out.push(text),
    stderr: (text: string) => err.push(text),
  };
  return { io, deps, stdout: () => out.join(''), stderr: () => err.join('') };
}

test('no WORKFLOW_RELEASE is a usage error', async () => {
  const t = setup({ env: {} });
  assert.equal(await run({ check: false }, t.deps), 1);
  assert.ok(t.stderr().includes("there is no release for flow 'standard' at /pkg/releases/standard."));
});

test('a folder that is not a release is refused', async () => {
  const t = setup({ files: {} });
  assert.equal(await run({ check: false }, t.deps), 1);
  assert.ok(t.stderr().includes(`${RELEASE} is not a release of lets-spec`));
});

test('a release with two schemas is accepted', async () => {
  const files = { ...releaseFiles, [`${RELEASE}/overlay/openspec/schemas/lets-minimal/schema.yaml`]: 'x' };
  const t = setup({ files, toplevel: '/project' });
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.equal(t.stderr(), '');
});

test('a release with no schema is refused', async () => {
  const files: Record<string, string> = { ...releaseFiles };
  delete files[`${RELEASE}/overlay/openspec/schemas/lets-standard/schema.yaml`];
  const t = setup({ files });
  assert.equal(await run({ check: false }, t.deps), 1);
  assert.ok(t.stderr().includes('holds no schema'));
});

test('a release whose config names a schema it does not ship is refused', async () => {
  const files = { ...releaseFiles, [`${RELEASE}/init/openspec/config.yaml`]: 'schema: lets-minimal\n' };
  const t = setup({ files });
  assert.equal(await run({ check: false }, t.deps), 1);
  assert.ok(t.stderr().includes("names 'lets-minimal', which the release does not ship"));
});

test('outside a git repo nothing is written', async () => {
  const t = setup();
  const before = new Map(t.io.files);
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.ok(t.stderr().includes('not inside a git repo'));
  assert.deepEqual(t.io.files, before);
});

test('inside a git repo a valid run exits 0 quietly', async () => {
  const t = setup({ toplevel: '/project' });
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.equal(t.stderr(), '');
});

test('a CLI version that differs from release.json is a warning in the footer', async () => {
  const release = '/pkg/releases/standard';
  const files: Record<string, string> = {};
  for (const [path, text] of Object.entries(releaseFiles)) files[path.replace(RELEASE, release)] = text;
  files['/pkg/release.json'] = JSON.stringify({ version: '0.1.0', openspec: '1.2.3', commit: 'abc' });
  const t = setup({ env: {}, files, toplevel: '/project' });
  const original = t.io.execFile;
  t.io.execFile = async (cmd, args, opts) => (cmd === 'openspec' ? { stdout: '1.4.0\n', stderr: '', code: 0 } : original(cmd, args, opts));
  t.io.dirs.add(release);
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.ok(t.stderr().includes('problem(s) to fix:'));
  assert.ok(t.stderr().includes('- the OpenSpec CLI on PATH is 1.4.0, but this release'));
});

test('a WORKFLOW_RELEASE outside the package still warns from the package release.json', async () => {
  const files: Record<string, string> = { ...releaseFiles };
  files['/pkg/release.json'] = JSON.stringify({ version: '0.1.0', openspec: '1.2.3', commit: 'abc' });
  const t = setup({ files, toplevel: '/project' });
  const original = t.io.execFile;
  t.io.execFile = async (cmd, args, opts) => (cmd === 'openspec' ? { stdout: '1.4.0\n', stderr: '', code: 0 } : original(cmd, args, opts));
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.ok(t.stderr().includes("- the OpenSpec CLI on PATH is 1.4.0, but this release's openspec-* skills were generated from 1.2.3. Pin the CLI to 1.2.3."));
});

test('an empty LETS_SPEC_SKILLS means the default, committed', () => {
  assert.equal(skillsMode({ LETS_SPEC_SKILLS: '' }), 'committed');
});

const LS_FILES = "git ls-files -- .agents/skills/lets-* .agents/skills/openspec-* openspec/schemas/lets-*";
const TRACKED = "git still tracks lets-spec copies that .gitignore ignores. Run: git rm -r --cached --ignore-unmatch -- '.agents/skills/lets-*' '.agents/skills/openspec-*' 'openspec/schemas/lets-*', then commit.";

// An ignored-mode project where git ls-files answers with result.
function ignoredWithLsFiles(result: { stdout: string; stderr: string; code: number | null }) {
  const t = setup({ env: { WORKFLOW_RELEASE: RELEASE, LETS_SPEC_SKILLS: 'ignored' }, toplevel: '/project' });
  const original = t.io.execFile;
  t.io.execFile = async (cmd, args, opts) => (`${cmd} ${args.join(' ')}` === LS_FILES ? result : original(cmd, args, opts));
  return t;
}

test('in the ignored mode, tracked copies are a problem to fix', async () => {
  const t = ignoredWithLsFiles({ stdout: '.agents/skills/lets-build/SKILL.md\n', stderr: '', code: 0 });
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.ok(t.stderr().includes(`problem(s) to fix:\n- ${TRACKED}\n`));
});

test('in the ignored mode, no tracked copies is no tracked-copies problem', async () => {
  const t = ignoredWithLsFiles({ stdout: '', stderr: '', code: 0 });
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.ok(!t.stderr().includes('git still tracks'));
});

test('in the ignored mode, a failed git ls-files counts as nothing tracked', async () => {
  const t = ignoredWithLsFiles({ stdout: '.agents/skills/lets-build/SKILL.md\n', stderr: 'fatal: boom', code: 128 });
  assert.equal(await run({ check: false }, t.deps), 0);
  assert.ok(!t.stderr().includes('git still tracks'));
});

const unownedFiles = { ...releaseFiles, [`${RELEASE}/overlay/.agents/skills/other/SKILL.md`]: 'skill' };

test('a release that ships an unowned skill writes nothing', async () => {
  const t = setup({ files: unownedFiles, toplevel: '/project' });
  const before = new Map(t.io.files);
  assert.equal(await run({ check: false }, t.deps), 1);
  assert.ok(t.stderr().includes('ships .agents/skills/other, which lets sync does not own.'));
  assert.deepEqual(t.io.files, before);
});

test('in the ignored mode, check refuses a release that ships an unowned skill', async () => {
  const t = setup({ env: { WORKFLOW_RELEASE: RELEASE, LETS_SPEC_SKILLS: 'ignored' }, files: unownedFiles, toplevel: '/project' });
  assert.equal(await run({ check: true }, t.deps), 1);
  assert.ok(t.stderr().includes('ships .agents/skills/other, which lets sync does not own.'));
});
