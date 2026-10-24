// The cli resolver through lets delegate: each command with the real cli
// adapter, on the kit's fake io, named in the config.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run as handoff } from '../../../../lets/src/delegate/handoff.ts';
import { run as instructions } from '../../../../lets/src/delegate/instructions.ts';
import { run as review } from '../../../../lets/src/delegate/review.ts';
import type { ReviewOptions } from '../../../../lets/src/delegate/review.ts';
import { createAdapter } from '../../../../lets/src/resolvers/cli/cli.ts';
import { commandDeps } from '../../delegate/fixtures/command-deps.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';
import type { FakeIo } from '../kit/fixtures/fake-io.ts';

const ONLY_CLI = 'version: 2\nresolvers: [cli]\n';

// commandDeps whose config is config, with the real cli adapter on io.
const withCli = (io: FakeIo, config = ONLY_CLI) => commandDeps({ config, real: { cli: createAdapter(io) } });

const reviewInstructions = { strategy: 'review', for: 'code' } as const;
const handoffInstructions = { strategy: 'handoff', for: 'apply' } as const;
// A review named x, from a claude author, on the gpt family.
const reviewOptions = (over: Partial<ReviewOptions> = {}): ReviewOptions =>
  ({ for: 'code', name: 'x', promptFile: 'p.md', sourceFamily: 'claude', effort: 'high', models: ['gpt'], ...over });
const handoffOptions = { name: 'fix-login', promptFile: 'p.md', models: ['claude'] };

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

test('a review declines with no family CLI on PATH, starting nothing', async () => {
  const io = fakeIo({ commands: ['some-tool'] });
  const t = withCli(io);
  assert.equal(await review(reviewOptions(), t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /every resolver declined/);
  assert.deepEqual(io.calls, []);
});

test('with no family CLI on PATH, the default answers the review instructions next', async () => {
  const io = fakeIo({ commands: [] });
  const t = withCli(io, 'version: 2\nresolvers: [cli, subagent]\n');
  assert.equal(await instructions(reviewInstructions, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
  assert.deepEqual(io.calls, []);
});

test('a handoff declines with every family CLI on PATH, starting nothing', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  const t = withCli(io);
  assert.equal(await handoff(handoffOptions, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /every resolver declined/);
  assert.deepEqual(io.calls, []);
});

test('handoff instructions skip cli with codex on PATH, running nothing, and the default answers', async () => {
  const io = fakeIo({ commands: ['codex'] });
  const t = withCli(io, 'version: 2\nresolvers: [cli, subagent]\n');
  assert.equal(await instructions(handoffInstructions, t.deps), 0);
  assert.equal(JSON.parse(t.stdout()).resolver, 'subagent');
  assert.deepEqual(io.calls, []);
});
