// lets-shape's backlog.mjs sets an issue's kind and priority. These tests
// run it against a fake gh, and check the calls it makes, in order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../skills/lets-shape/scripts/lib/main.mjs';
import { fakeGh, NOT_FOUND, runWith } from './fixtures/fake-gh.mjs';

const issue7 = JSON.stringify({ number: 7, labels: [], assignees: [] });
const FIELD_WRITE = ['api', '--method', 'POST', 'repos/{owner}/{repo}/issues/7/issue-field-values',
  '-F', 'issue_field_values[][field_id]=42', '-f', 'issue_field_values[][value]=Should'];

// The answers of a repo that records kind and priority with labels, and has
// none of them yet.
function labelsRepo(args) {
  const line = args.join(' ');
  if (line === 'api repos/{owner}/{repo}/issues/7') return issue7;
  if (line.startsWith('api repos/{owner}/{repo}/labels/')) return NOT_FOUND;
  return undefined;
}

// The answers of a repo in the org "o", whose Priority field has id 42.
function fieldsRepo(args) {
  switch (args.join(' ')) {
    case 'api repos/{owner}/{repo} --jq .owner.login': return 'o\n';
    case 'api orgs/o/issue-fields': return JSON.stringify([{ id: 42, name: 'Priority' }]);
    case 'api repos/{owner}/{repo}/issues/7': return JSON.stringify({ number: 7, labels: [{ name: 'priority/must' }], assignees: [] });
    default: return undefined;
  }
}

test('set-priority with labels creates a missing label, then adds it', async () => {
  const gh = fakeGh(labelsRepo);
  const { code, stderr } = await runWith(run, ['set-priority', '7', 'Must'], { mode: 'labels', execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.deepEqual(gh.calls, [
    ['api', 'repos/{owner}/{repo}/issues/7'],
    ['api', 'repos/{owner}/{repo}/labels/priority%2Fmust'],
    ['label', 'create', 'priority/must', '--description', 'MoSCoW priority: Must', '--color', 'ededed'],
    ['issue', 'edit', '7', '--add-label', 'priority/must'],
  ]);
});

test('set-priority with labels does not create a label the repo has', async () => {
  const gh = fakeGh((args) => (args[1]?.startsWith('repos/{owner}/{repo}/labels/')
    ? JSON.stringify({ name: 'priority/must' })
    : labelsRepo(args)));
  const { code } = await runWith(run, ['set-priority', '7', 'Must'], { mode: 'labels', execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(gh.calls.filter((args) => args[0] === 'label' && args[1] === 'create').length, 0);
});

test('a write stops, and creates no label, when looking up the label fails', async () => {
  const gh = fakeGh((args) => (args[1]?.startsWith('repos/{owner}/{repo}/labels/')
    ? { stderr: 'gh: Server Error (HTTP 500)\n', code: 1 }
    : labelsRepo(args)));
  const { code, stdout, stderr } = await runWith(run, ['set-priority', '7', 'Must'], { mode: 'labels', execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'gh: Server Error (HTTP 500)\nbacklog.mjs: gh api repos/{owner}/{repo}/labels/priority%2Fmust failed.\n');
  assert.deepEqual(gh.calls.filter((args) => ['label', 'issue'].includes(args[0])), []);
});

test('set-priority with fields sets the field, then removes the priority label', async () => {
  const gh = fakeGh(fieldsRepo);
  const { code, stderr } = await runWith(run, ['set-priority', '7', 'Should'], { mode: 'fields', execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.deepEqual(gh.calls.slice(-2), [FIELD_WRITE, ['issue', 'edit', '7', '--remove-label', 'priority/must']]);
});

test('a write stops at the first gh command that fails', async () => {
  const gh = fakeGh((args) => (args.join(' ').startsWith('api --method POST') ? { code: 1 } : fieldsRepo(args)));
  const { code, stderr } = await runWith(run, ['set-priority', '7', 'Should'], { mode: 'fields', execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stderr, `backlog.mjs: gh ${FIELD_WRITE.join(' ')} failed.\n`);
  assert.equal(gh.calls.filter((args) => args[0] === 'issue').length, 0);
});

test('set-priority with fields fails when the owner has no Priority field', async () => {
  for (const answer of ['[]', NOT_FOUND]) {
    const gh = fakeGh((args) => (args.join(' ') === 'api orgs/o/issue-fields' ? answer : fieldsRepo(args)));
    const { code, stdout, stderr } = await runWith(run, ['set-priority', '7', 'Should'], { mode: 'fields', execFile: gh.execFile });
    assert.equal(code, 1);
    assert.equal(stdout, '');
    assert.equal(stderr, 'backlog.mjs: o has no Priority issue field. Use the github-labels backlog in the flake, or add the field.\n');
  }
});

test('set-kind with fields needs no Priority field', async () => {
  const gh = fakeGh((args) => (args.join(' ') === 'api orgs/o/issue-fields' ? '[]' : fieldsRepo(args)));
  const { code } = await runWith(run, ['set-kind', '7', 'Epic'], { mode: 'fields', execFile: gh.execFile });
  assert.equal(code, 0);
  assert.deepEqual(gh.calls, [
    ['api', 'repos/{owner}/{repo}/issues/7'],
    ['issue', 'edit', '7', '--type', 'Epic'],
  ]);
});

test('a write refuses a value it does not know, and changes nothing', async () => {
  const gh = fakeGh(labelsRepo);
  const { code, stdout, stderr } = await runWith(run, ['set-priority', '7', 'High'], { mode: 'labels', execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, "backlog.mjs: priority must be Must, Should, Could or Wont, got 'High'.\n");
  assert.deepEqual(gh.calls, [['api', 'repos/{owner}/{repo}/issues/7']]);
});

test("lets-shape's backlog.mjs prints its usage", async () => {
  const help = await runWith(run, ['--help'], { mode: 'labels', execFile: fakeGh().execFile });
  assert.equal(help.code, 0);
  assert.match(help.stdout, /backlog\.mjs set-priority <n> <Must\|Should\|Could\|Wont>/);
  assert.match(help.stdout, /backlog\.mjs set-kind <n> <Epic\|Story>/);
  assert.equal(help.stderr, '');
  const none = await runWith(run, [], { mode: 'labels', execFile: fakeGh().execFile });
  assert.equal(none.code, 1);
  assert.match(none.stdout, /Usage:/);
  assert.equal(none.stderr, '');
});

test("lets-shape's backlog.mjs only sets kind and priority", async () => {
  const { code, stderr } = await runWith(run, ['next'], { mode: 'labels', execFile: fakeGh().execFile });
  assert.equal(code, 1);
  assert.equal(stderr, "backlog.mjs: unknown command 'next'. Use set-priority or set-kind.\n");
});

test("lets-shape's backlog.mjs needs an issue number", async () => {
  const seven = await runWith(run, ['set-kind', 'seven', 'Epic'], { mode: 'labels', execFile: fakeGh().execFile });
  assert.equal(seven.code, 1);
  assert.equal(seven.stderr, "backlog.mjs: expected an issue number, got 'seven'.\n");
  const none = await runWith(run, ['set-kind'], { mode: 'labels', execFile: fakeGh().execFile });
  assert.equal(none.code, 1);
  assert.equal(none.stderr, "backlog.mjs: expected an issue number, got ''.\n");
});

test("lets-shape's backlog.mjs writes only in the mode the release build gives it", async () => {
  const gh = fakeGh(labelsRepo);
  const { code, stderr } = await runWith(run, ['set-priority', '7', 'Must'], { mode: '@backlog-mode@', execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stderr, 'backlog.mjs: this copy has no backlog mode. Run the copy lets-sync links into .agents/skills/lets-shape/.\n');
  assert.deepEqual(gh.calls, []);
});

test('the owner login is trimmed before the issue-fields lookup', async () => {
  const gh = fakeGh(fieldsRepo); // answers 'o\n' for the owner
  await runWith(run, ['set-priority', '7', 'Should'], { mode: 'fields', execFile: gh.execFile });
  assert.ok(gh.calls.some((args) => args.join(' ') === 'api orgs/o/issue-fields'));
});

test('a label is looked up by its encoded name, and created by its plain name', async () => {
  const gh = fakeGh(labelsRepo);
  await runWith(run, ['set-kind', '7', 'Epic'], { mode: 'labels', execFile: gh.execFile });
  assert.deepEqual(gh.calls.slice(1), [
    ['api', 'repos/{owner}/{repo}/labels/kind%2Fepic'],
    ['label', 'create', 'kind/epic', '--description', 'A parent issue whose stories are its sub-issues', '--color', 'ededed'],
    ['issue', 'edit', '7', '--add-label', 'kind/epic'],
  ]);
});
