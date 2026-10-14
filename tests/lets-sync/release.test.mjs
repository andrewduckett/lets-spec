import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsageError } from '../../lets-sync/lib/main.mjs';
import { findRelease, openspecVersionWarning } from '../../lets-sync/lib/release.mjs';
import { fakeIo } from './fixtures/fake-io.mjs';

const RELEASE = '/pkg/releases/standard-github-labels';
const RELEASE_JSON = '/pkg/release.json';
const info = (openspec) => JSON.stringify({ version: '0.1.0', openspec, commit: 'abc' });

test('WORKFLOW_RELEASE wins over the flow and backlog', () => {
  const env = { WORKFLOW_RELEASE: '/elsewhere', LETS_SPEC_FLOW: 'minimal' };
  assert.equal(findRelease(env, '/pkg', fakeIo()), '/elsewhere');
});

test('the default pair is standard-github-labels under packageRoot/releases', () => {
  const io = fakeIo({ dirs: [RELEASE] });
  assert.equal(findRelease({}, '/pkg', io), RELEASE);
});

test('LETS_SPEC_FLOW and LETS_SPEC_BACKLOG pick the pair', () => {
  const io = fakeIo({ dirs: ['/pkg/releases/minimal-github-fields'] });
  const env = { LETS_SPEC_FLOW: 'minimal', LETS_SPEC_BACKLOG: 'github-fields' };
  assert.equal(findRelease(env, '/pkg', io), '/pkg/releases/minimal-github-fields');
});

test('a missing pair names both variables', () => {
  const env = { LETS_SPEC_FLOW: 'minimal', LETS_SPEC_BACKLOG: 'jira' };
  assert.throws(() => findRelease(env, '/pkg', fakeIo()), (error) => {
    assert.ok(error instanceof UsageError);
    assert.equal(error.message, "there is no release for flow 'minimal' and backlog 'jira' at /pkg/releases/minimal-jira. Set LETS_SPEC_FLOW and LETS_SPEC_BACKLOG to a pair this release ships, or WORKFLOW_RELEASE to a release folder.");
    return true;
  });
});

test('no release.json means no version warning', async () => {
  const io = fakeIo({ openspec: '1.2.3\n' });
  assert.equal(await openspecVersionWarning({ release: RELEASE, io }), null);
});

test('a missing openspec command means no version warning', async () => {
  const io = fakeIo({ files: { [RELEASE_JSON]: info('1.2.3') } });
  assert.equal(await openspecVersionWarning({ release: RELEASE, io }), null);
});

test('output that is not a version means no version warning', async () => {
  const io = fakeIo({ files: { [RELEASE_JSON]: info('1.2.3') }, openspec: 'command not found: openspec\n' });
  assert.equal(await openspecVersionWarning({ release: RELEASE, io }), null);
});

test('a release.json that is not JSON means no version warning', async () => {
  const io = fakeIo({ files: { [RELEASE_JSON]: 'oops' }, openspec: '1.2.3\n' });
  assert.equal(await openspecVersionWarning({ release: RELEASE, io }), null);
});

test('the same version means no version warning', async () => {
  const io = fakeIo({ files: { [RELEASE_JSON]: info('1.2.3') }, openspec: '1.2.3\n' });
  assert.equal(await openspecVersionWarning({ release: RELEASE, io }), null);
});

test('a different version is warned about', async () => {
  const io = fakeIo({ files: { [RELEASE_JSON]: info('1.2.3') }, openspec: 'openspec 1.4.0\n' });
  assert.equal(await openspecVersionWarning({ release: RELEASE, io }),
    "the OpenSpec CLI on PATH is 1.4.0, but this release's openspec-* skills were generated from 1.2.3. Pin the CLI to 1.2.3.");
});
