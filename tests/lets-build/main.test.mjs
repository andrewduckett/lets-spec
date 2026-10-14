// lets-build's backlog.mjs picks and claims a story. These tests run it
// against a fake gh, and check the calls it makes, in order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../skills/lets-build/scripts/lib/main.mjs';
import { fakeGh, runWith } from './fixtures/fake-gh.mjs';

const issue7 = JSON.stringify({ number: 7, labels: [], assignees: [] });
const SEARCH = ['api', '--paginate', '--slurp', '-X', 'GET', 'search/issues', '-f', 'advanced_search=true', '-f', 'per_page=100',
  '-f', 'q=repo:o/r is:issue is:open no:assignee -is:blocked -label:kind/epic -type:Epic'];

// A search page that holds one story.
function page(n, priority) {
  return { items: [{ number: n, title: `story-${n}`, html_url: `u${n}`, labels: [{ name: `priority/${priority}` }] }] };
}

// The answers of a repo named o/r whose story search finds pages. As gh
// does, it answers every page with --paginate --slurp, and only the first
// without.
function searchAnswer(pages) {
  return (args) => {
    const line = args.join(' ');
    if (line === 'api repos/{owner}/{repo} --jq .full_name') return 'o/r\n';
    if (line.includes('search/issues')) {
      return args.includes('--paginate') && args.includes('--slurp') ? JSON.stringify(pages) : JSON.stringify(pages[0]);
    }
    return undefined;
  };
}

test('next prints the story to work on, then its URL', async () => {
  const gh = fakeGh(searchAnswer([page(4, 'should')]));
  const { code, stdout, stderr } = await runWith(run, ['next'], { execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout, '#4 [should] story-4\nu4\n');
  assert.equal(stderr, '');
  assert.deepEqual(gh.calls, [['api', 'repos/{owner}/{repo}', '--jq', '.full_name'], SEARCH]);
});

test('next ranks the stories on every page of the search', async () => {
  const gh = fakeGh(searchAnswer([page(1, 'could'), page(200, 'must')]));
  const { code, stdout } = await runWith(run, ['next'], { execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout.split('\n')[0], '#200 [must] story-200');
});

test('next fails when no story is ready', async () => {
  const gh = fakeGh(searchAnswer([{ items: [] }]));
  const { code, stdout, stderr } = await runWith(run, ['next'], { execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'backlog.mjs: no story is ready. Every open story is an epic, assigned, blocked, untriaged or Wont.\n');
});

test('next fails when no story is ready, even when the search finds no page', async () => {
  const gh = fakeGh((args) => (args.join(' ').startsWith('api repos/{owner}/{repo}') ? 'o/r\n' : '[]'));
  const { code, stderr } = await runWith(run, ['next'], { execFile: gh.execFile });
  assert.equal(code, 1);
  assert.match(stderr, /no story is ready/);
});

test('next fails when the search fails', async () => {
  const answer = searchAnswer([page(4, 'should')]);
  const gh = fakeGh((args) => (args.includes('search/issues')
    ? { stderr: 'gh: Server Error (HTTP 502)\n', code: 1 }
    : answer(args)));
  const { code, stdout, stderr } = await runWith(run, ['next'], { execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, `gh: Server Error (HTTP 502)\nbacklog.mjs: gh ${SEARCH.join(' ')} failed.\n`);
});

test('claim assigns the story to the current user', async () => {
  const gh = fakeGh((args) => (args.join(' ') === 'api repos/{owner}/{repo}/issues/7' ? issue7 : undefined));
  const { code, stderr } = await runWith(run, ['claim', '7'], { execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.deepEqual(gh.calls, [
    ['api', 'repos/{owner}/{repo}/issues/7'],
    ['issue', 'edit', '7', '--add-assignee', '@me'],
  ]);
});

test('claim refuses a story someone else has, and changes nothing', async () => {
  const gh = fakeGh(() => JSON.stringify({ number: 7, labels: [], assignees: [{ login: 'octocat' }] }));
  const { code, stdout, stderr } = await runWith(run, ['claim', '7'], { execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'backlog.mjs: #7 is already assigned to octocat. Run backlog.mjs next for another story.\n');
  assert.deepEqual(gh.calls, [['api', 'repos/{owner}/{repo}/issues/7']]);
});

test("lets-build's backlog.mjs prints its usage", async () => {
  const help = await runWith(run, ['--help'], { execFile: fakeGh().execFile });
  assert.equal(help.code, 0);
  assert.match(help.stdout, /backlog\.mjs next/);
  assert.match(help.stdout, /backlog\.mjs claim <n>/);
  assert.equal(help.stderr, '');
  assert.equal((await runWith(run, ['-h'], { execFile: fakeGh().execFile })).code, 0);
  const none = await runWith(run, [], { execFile: fakeGh().execFile });
  assert.equal(none.code, 1);
  assert.match(none.stdout, /Usage:/);
  assert.equal(none.stderr, '');
});

test("lets-build's backlog.mjs only picks and claims", async () => {
  const gh = fakeGh();
  const { code, stderr } = await runWith(run, ['set-kind', '7', 'Epic'], { execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stderr, "backlog.mjs: unknown command 'set-kind'. Use next or claim.\n");
  assert.deepEqual(gh.calls, []);
});

test("lets-build's backlog.mjs needs an issue number to claim", async () => {
  const seven = await runWith(run, ['claim', 'seven'], { execFile: fakeGh().execFile });
  assert.equal(seven.code, 1);
  assert.equal(seven.stderr, "backlog.mjs: expected an issue number, got 'seven'.\n");
  const none = await runWith(run, ['claim'], { execFile: fakeGh().execFile });
  assert.equal(none.code, 1);
  assert.equal(none.stderr, "backlog.mjs: expected an issue number, got ''.\n");
});

test('a gh that cannot start is reported as a failed command', async () => {
  const execFile = async () => ({ stdout: '', stderr: 'spawn gh ENOENT', code: null });
  const { code, stderr } = await runWith(run, ['claim', '7'], { execFile });
  assert.equal(code, 1);
  assert.match(stderr, /spawn gh ENOENT/);
  assert.match(stderr, /backlog\.mjs: gh api repos\/\{owner\}\/\{repo\}\/issues\/7 failed\./);
});
