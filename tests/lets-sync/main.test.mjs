import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, skillsMode } from '../../lets-sync/lib/main.mjs';
import { fakeIo } from './fixtures/fake-io.mjs';

const RELEASE = '/store/abc-lets-spec-release';

// A release the validators accept: one skill, one schema, init and fragments.
const releaseFiles = {
  [`${RELEASE}/overlay/.agents/skills/lets-build/SKILL.md`]: 'skill',
  [`${RELEASE}/overlay/openspec/schemas/lets-standard/schema.yaml`]: 'schema',
  [`${RELEASE}/init/openspec/config.yaml`]: 'schema: lets-standard\n',
  [`${RELEASE}/fragments/AGENTS.md`]: 'rules\n',
};

function setup({ env = { WORKFLOW_RELEASE: RELEASE }, files = releaseFiles, toplevel = null } = {}) {
  const io = fakeIo({ files, toplevel });
  const out = [];
  const err = [];
  const deps = {
    env, cwd: '/project', packageRoot: '/pkg', io,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  };
  return { io, deps, stdout: () => out.join(''), stderr: () => err.join('') };
}

test('--help prints the usage and exits 0', async () => {
  const t = setup({ env: {} });
  assert.equal(await run(['--help'], t.deps), 0);
  assert.ok(t.stdout().startsWith('lets-sync: set up a project'));
  assert.ok(t.stdout().includes('Usage: lets-sync [--check]'));
  assert.ok(t.stdout().includes('LETS_SPEC_SKILLS=ignored'));
  assert.ok(!t.stdout().includes('Nix store'));
  assert.ok(t.stdout().endsWith('The Nix wrapper sets WORKFLOW_RELEASE.\n'));
  assert.ok(!t.stdout().includes('set -euo'));
});

test('an unknown option is a usage error', async () => {
  const t = setup();
  assert.equal(await run(['--force'], t.deps), 1);
  assert.ok(t.stderr().includes('error: unknown option --force. Usage: lets-sync [--check]'));
});

test('no WORKFLOW_RELEASE is a usage error', async () => {
  const t = setup({ env: {} });
  assert.equal(await run([], t.deps), 1);
  assert.ok(t.stderr().includes("there is no release for flow 'standard' at /pkg/releases/standard."));
});

test('a folder that is not a release is refused', async () => {
  const t = setup({ files: {} });
  assert.equal(await run([], t.deps), 1);
  assert.ok(t.stderr().includes(`${RELEASE} is not a release of lets-spec`));
});

test('a release with two schemas is accepted', async () => {
  const files = { ...releaseFiles, [`${RELEASE}/overlay/openspec/schemas/lets-minimal/schema.yaml`]: 'x' };
  const t = setup({ files, toplevel: '/project' });
  assert.equal(await run([], t.deps), 0);
  assert.equal(t.stderr(), '');
});

test('a release with no schema is refused', async () => {
  const files = { ...releaseFiles };
  delete files[`${RELEASE}/overlay/openspec/schemas/lets-standard/schema.yaml`];
  const t = setup({ files });
  assert.equal(await run([], t.deps), 1);
  assert.ok(t.stderr().includes('holds no schema'));
});

test('a release whose config names a schema it does not ship is refused', async () => {
  const files = { ...releaseFiles, [`${RELEASE}/init/openspec/config.yaml`]: 'schema: lets-minimal\n' };
  const t = setup({ files });
  assert.equal(await run([], t.deps), 1);
  assert.ok(t.stderr().includes("names 'lets-minimal', which the release does not ship"));
});

test('outside a git repo nothing is written', async () => {
  const t = setup();
  const before = new Map(t.io.files);
  assert.equal(await run([], t.deps), 0);
  assert.ok(t.stderr().includes('not inside a git repo'));
  assert.deepEqual(t.io.files, before);
});

test('inside a git repo a valid run exits 0 quietly', async () => {
  const t = setup({ toplevel: '/project' });
  assert.equal(await run([], t.deps), 0);
  assert.equal(t.stderr(), '');
});

test('a CLI version that differs from release.json is a warning in the footer', async () => {
  const release = '/pkg/releases/standard';
  const files = {};
  for (const [path, text] of Object.entries(releaseFiles)) files[path.replace(RELEASE, release)] = text;
  files['/pkg/release.json'] = JSON.stringify({ version: '0.1.0', openspec: '1.2.3', commit: 'abc' });
  const t = setup({ env: {}, files, toplevel: '/project' });
  t.io.openspec = null;
  const original = t.io.execFile;
  t.io.execFile = async (cmd, args, opts) => (cmd === 'openspec' ? { stdout: '1.4.0\n', stderr: '', code: 0 } : original(cmd, args, opts));
  t.io.dirs.add(release);
  assert.equal(await run([], t.deps), 0);
  assert.ok(t.stderr().includes('problem(s) to fix:'));
  assert.ok(t.stderr().includes('- the OpenSpec CLI on PATH is 1.4.0, but this release'));
});

test('an empty LETS_SPEC_SKILLS means the default, committed', () => {
  assert.equal(skillsMode({ LETS_SPEC_SKILLS: '' }), 'committed');
});
