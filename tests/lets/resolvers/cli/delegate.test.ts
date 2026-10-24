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

// An io with every CLI on PATH, whose one run prints FINDINGS: codex in its
// last-message file, the others on stdout.
const answering = () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'], results: [(cmd, args) => {
    if (cmd === 'codex') io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS\n');
    return { stdout: cmd === 'codex' ? '' : 'FINDINGS\n', stderr: '', code: 0 };
  }] });
  return io;
};
const argsOf = (io: FakeIo) => io.calls.map(([cmd, args]) => [cmd, args]);
// The review's JSON line on stderr.
const metadata = (t: ReturnType<typeof withCli>) => JSON.parse(t.stderr());

test('a review with codex prints codex\'s final message, on gpt, with a process handle', async () => {
  const t = withCli(answering());
  assert.equal(await review(reviewOptions(), t.deps), 0);
  assert.equal(t.stdout(), 'FINDINGS\n');
  const { resolver, family, model, handle } = metadata(t);
  assert.deepEqual({ resolver, family, model, handle }, { resolver: 'cli', family: 'gpt', model: 'gpt', handle: { kind: 'process', id: 'x' } });
});

test('a review with codex runs the given model with -m, and names it', async () => {
  const io = answering();
  const t = withCli(io);
  assert.equal(await review(reviewOptions({ models: ['gpt/gpt-6-luna'] }), t.deps), 0);
  assert.equal(io.calls.length, 1);
  const args = io.calls[0][1];
  assert.deepEqual(args.slice(args.indexOf('-m'), args.indexOf('-m') + 2), ['-m', 'gpt-6-luna']);
  assert.deepEqual([metadata(t).family, metadata(t).model], ['gpt', 'gpt-6-luna']);
});

test('a bare family runs the CLI with no model argument', async () => {
  const io = answering();
  const t = withCli(io);
  assert.equal(await review(reviewOptions({ models: ['claude'] }), t.deps), 0);
  assert.deepEqual(argsOf(io), [['claude', ['-p', '--permission-mode', 'plan', '--effort', 'high']]]);
  assert.equal(metadata(t).family, 'claude');
});

test('a gemini model runs with the review\'s effort added', async () => {
  const io = answering();
  assert.equal(await review(reviewOptions({ models: ['gemini/gemini-3.8-flash'], effort: 'high' }), withCli(io).deps), 0);
  assert.deepEqual(argsOf(io)[0][1].slice(4, 6), ['--model', 'gemini-3.8-flash-high']);
});

test('a model the CLI never listed is still tried', async () => {
  const io = answering();
  await review(reviewOptions({ models: ['gpt/gpt-6-astra'] }), withCli(io).deps);
  assert.equal(io.calls.length, 1);
  assert.ok(io.calls[0][1].includes('gpt-6-astra'));
});

test('codex refusing the model is exit 3, with the end of its stderr', async () => {
  const t = withCli(fakeIo({ commands: ['codex'], results: [{ stdout: '', stderr: 'error: model gpt-6-astra not available', code: 1 }] }));
  assert.equal(await review(reviewOptions({ models: ['gpt/gpt-6-astra'] }), t.deps), 3);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /^lets delegate: gpt\/gpt-6-astra: .*model gpt-6-astra not available/m);
});

test('a codex refusal after an earlier review with the same name is exit 3, not 5', async () => {
  const io = fakeIo({ commands: ['codex'], files: { '/repo/.workspace/lets-delegate/x.last-message.md': 'OLD FINDINGS\n' },
    results: [{ stdout: '', stderr: 'model not available', code: 1 }] });
  assert.equal(await review(reviewOptions({ models: ['gpt/gpt-6-astra'] }), withCli(io).deps), 3);
});

// A claude review, from a codex author, with 3 minutes, whose CLI answers
// with result, on io when given.
const claudeReview = async (result: NonNullable<Parameters<typeof fakeIo>[0]>['results'], io = fakeIo({ commands: ['claude'], results: result })) => {
  const t = withCli(io);
  const code = await review(reviewOptions({ sourceFamily: 'gpt', models: ['claude'], timeoutMinutes: 3 }), t.deps);
  return { code, stdout: t.stdout(), stderr: t.stderr() };
};

test('a CLI that prints and then exits non-zero is exit 5, with its exit and stderr', async () => {
  const answer = await claudeReview([{ stdout: 'half a review', stderr: 'rate limited', code: 2 }]);
  assert.deepEqual([answer.code, answer.stdout], [5, '']);
  assert.match(answer.stderr, /claude failed: exit 2: rate limited/);
});

test('a CLI that exits non-zero having printed nothing is a refusal, exit 3, with the end of its stderr', async () => {
  const answer = await claudeReview([{ stdout: '', stderr: 'model not found', code: 1 }]);
  assert.deepEqual([answer.code, answer.stdout], [3, '']);
  assert.match(answer.stderr, /claude refused: exit 1: model not found/);
});

test('a CLI that ends with an empty message is exit 5', async () => {
  const answer = await claudeReview([{ stdout: '\n', stderr: '', code: 0 }]);
  assert.equal(answer.code, 5);
  assert.match(answer.stderr, /empty final message/);
});

test('a codex review that writes no last message is exit 5', async () => {
  const t = withCli(fakeIo({ commands: ['codex'] }));
  assert.equal(await review(reviewOptions(), t.deps), 5);
  assert.match(t.stderr(), /empty final message/);
});

test('a CLI that cannot start is a refusal, exit 3, naming the CLI', async () => {
  const io = fakeIo({ commands: ['claude'], execFile: async (cmd) => {
    throw new Error(`cannot run ${cmd}: spawn ${cmd} EACCES`);
  } });
  const answer = await claudeReview([], io);
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /^lets delegate: claude: cannot run claude: /m);
});

test('a CLI that runs past the timeout is stopped, and is exit 6', async () => {
  const answer = await claudeReview([{ stdout: '', stderr: '', code: 1, timedOut: true }]);
  assert.equal(answer.code, 6);
  assert.match(answer.stderr, /claude did not finish in 3 minutes/);
});

const LAST_MESSAGE = '/repo/.workspace/lets-delegate/cli-resolver.last-message.md';
// A codex review named cli-resolver, which leaves the tree as gitAfter says.
const codexReview = async (gitAfter = '') => {
  const io = answering();
  const t = commandDeps({ config: ONLY_CLI, real: { cli: createAdapter(io) }, gitAfter });
  const code = await review(reviewOptions({ name: 'cli-resolver' }), t.deps);
  return { code, io };
};

test('a clean review removes its last-message file', async () => {
  const { code, io } = await codexReview();
  assert.equal(code, 0);
  assert.equal(io.exists(LAST_MESSAGE), false);
});

test('a review that changed the tree keeps its last-message file', async () => {
  const { code, io } = await codexReview(' M src/a.js\0');
  assert.equal(code, 7);
  assert.equal(io.exists(LAST_MESSAGE), true);
});

test('a clean claude review, which writes no files, removes nothing', async () => {
  const io = answering();
  assert.equal(await review(reviewOptions({ models: ['claude'] }), withCli(io).deps), 0);
  assert.deepEqual(io.removed, []);
});

// The adapter itself: the chain only ever finishes a handle the adapter
// made, so these cases cannot be reached through a command.

test('finish removes nothing for a process handle whose id is not a session name', async () => {
  const io = fakeIo({ commands: ['codex'], files: { '/repo/.workspace/lets-delegate/../x.last-message.md': 'X' } });
  await assert.rejects(createAdapter(io).finish({ kind: 'process', id: '../x' }, true, { cwd: '/repo' }), /not a session name/);
  assert.deepEqual(io.removed, []);
});
