import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../lets-sync/lib/main.mjs';
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
  assert.ok(t.stdout().endsWith('The Nix wrapper sets it.\n'));
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
  assert.ok(t.stderr().includes('WORKFLOW_RELEASE is not set'));
});

test('a folder that is not a release is refused', async () => {
  const t = setup({ files: {} });
  assert.equal(await run([], t.deps), 1);
  assert.ok(t.stderr().includes(`${RELEASE} is not a release of lets-spec`));
});

test('a release with two schemas is refused', async () => {
  const files = { ...releaseFiles, [`${RELEASE}/overlay/openspec/schemas/lets-minimal/schema.yaml`]: 'x' };
  const t = setup({ files });
  assert.equal(await run([], t.deps), 1);
  assert.ok(t.stderr().includes('holds 2 schemas'));
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
