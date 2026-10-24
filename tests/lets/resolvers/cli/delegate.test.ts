// The cli resolver through lets delegate: each command with the real cli
// adapter, on the kit's fake io, named in the config.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run as instructions } from '../../../../lets/src/delegate/instructions.ts';
import { createAdapter } from '../../../../lets/src/resolvers/cli/cli.ts';
import { commandDeps } from '../../delegate/fixtures/command-deps.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';
import type { FakeIo } from '../kit/fixtures/fake-io.ts';

const ONLY_CLI = 'version: 2\nresolvers: [cli]\n';

// commandDeps whose config is config, with the real cli adapter on io.
const withCli = (io: FakeIo, config = ONLY_CLI) => commandDeps({ config, real: { cli: createAdapter(io) } });

const reviewInstructions = { strategy: 'review', for: 'code' } as const;

test('review instructions answer cli with one family CLI on PATH', async () => {
  const t = withCli(fakeIo({ commands: ['claude'] }));
  assert.equal(await instructions(reviewInstructions, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'review', for: 'code', resolver: 'cli', options: ['claude'], guidance: null });
  assert.equal(t.stderr(), '');
});

test('review instructions answer cli inside another harness', async () => {
  const listing = { stdout: JSON.stringify({ models: [{ slug: 'gpt-6-luna', visibility: 'list' }] }), stderr: '', code: 0 };
  const t = withCli(fakeIo({ commands: ['codex'], env: { PATH: '/bin', T3CODE_HOME: '/home/u/.t3' }, results: [listing] }));
  assert.equal(await instructions(reviewInstructions, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'cli');
  assert.deepEqual(JSON.parse(t.stdout()).options, ['gpt/gpt-6-luna']);
});

test('review instructions list the bare family when codex is signed out, and warn naming codex', async () => {
  const t = withCli(fakeIo({ commands: ['codex', 'claude'], results: [{ stdout: '', stderr: 'not logged in', code: 1 }] }));
  assert.equal(await instructions(reviewInstructions, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()).options, ['gpt', 'claude']);
  assert.match(t.stderr(), /^lets delegate: .*codex/);
});
