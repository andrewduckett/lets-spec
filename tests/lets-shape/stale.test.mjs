// lets-shape's stale-links.mjs lists the issue links in a discovery map that
// point at closed issues. These tests run it against a fake gh.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLinks, run } from '../../skills/lets-shape/scripts/lib/stale.mjs';
import { fakeGh, runWith } from './fixtures/fake-gh.mjs';

// Issues 1 and 3 in o/r are closed; every other issue is open.
function answer(args) {
  const [, , n, , repo] = args;
  if (repo === 'o/r' && n === '1') return JSON.stringify({ state: 'CLOSED', title: 'Ship: the first story' });
  if (repo === 'o/r' && n === '3') return JSON.stringify({ state: 'CLOSED', title: 'Third' });
  return JSON.stringify({ state: 'OPEN', title: 'Still going' });
}

// A readFile that holds one map, at map.md.
function mapOf(text) {
  return (path) => {
    if (path !== 'map.md') throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' });
    return text;
  };
}

test('stale-links prints each link to a closed issue, with its line, in file order', async () => {
  const gh = fakeGh(answer);
  const readFile = mapOf('# Map\n- [one](https://github.com/o/r/issues/1)\n- [two](https://github.com/o/r/issues/2)\n- [three](https://github.com/o/r/issues/3)\n');
  const { code, stdout, stderr } = await runWith(run, ['map.md'], { readFile, execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout, '2: #1 Ship: the first story\n4: #3 Third\n');
  assert.equal(stderr, '');
  assert.deepEqual(gh.calls, ['1', '2', '3'].map((n) => ['issue', 'view', n, '-R', 'o/r', '--json', 'state,title']));
});

test('stale-links looks up each issue once, however often the map links it', async () => {
  const gh = fakeGh(answer);
  const readFile = mapOf('https://github.com/o/r/issues/1\nhttps://github.com/o/r/issues/1\n');
  const { code, stdout } = await runWith(run, ['map.md'], { readFile, execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout, '1: #1 Ship: the first story\n2: #1 Ship: the first story\n');
  assert.equal(gh.calls.length, 1);
});

test('stale-links tells the same number in two repos apart', async () => {
  const gh = fakeGh(answer);
  const readFile = mapOf('https://github.com/o/r/issues/1\nhttps://github.com/o/other/issues/1\n');
  const { code, stdout } = await runWith(run, ['map.md'], { readFile, execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout, '1: #1 Ship: the first story\n');
});

test('stale-links prints nothing for a map with no issue links', async () => {
  const gh = fakeGh(answer);
  const readFile = mapOf('# Map\nhttps://github.com/o/r/pull/1\nhttps://github.com/o/r/issues/\n');
  const { code, stdout, stderr } = await runWith(run, ['map.md'], { readFile, execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout, '');
  assert.equal(stderr, '');
  assert.deepEqual(gh.calls, []);
});

test('stale-links fails when the map is missing', async () => {
  const gh = fakeGh(answer);
  const { code, stdout, stderr } = await runWith(run, ['nosuch.md'], { readFile: mapOf(''), execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, "stale-links.mjs: cannot read nosuch.md: ENOENT: no such file or directory, open 'nosuch.md'\n");
  assert.deepEqual(gh.calls, []);
});

test('stale-links fails when an issue cannot be looked up', async () => {
  const gh = fakeGh(() => ({ stderr: 'gh: Could not resolve to an issue\n', code: 1 }));
  const readFile = mapOf('https://github.com/o/r/issues/1\n');
  const { code, stdout, stderr } = await runWith(run, ['map.md'], { readFile, execFile: gh.execFile });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'gh: Could not resolve to an issue\nstale-links.mjs: gh issue view 1 -R o/r --json state,title failed.\n');
});

test('stale-links prints its usage when given no map', async () => {
  const gh = fakeGh(answer);
  const none = await runWith(run, [], { readFile: mapOf(''), execFile: gh.execFile });
  assert.equal(none.code, 1);
  assert.equal(none.stdout, '');
  assert.equal(none.stderr, 'usage: stale-links.mjs <path/to/discovery.md>\n');
  const help = await runWith(run, ['--help'], { readFile: mapOf(''), execFile: gh.execFile });
  assert.equal(help.code, 0);
  assert.equal(help.stdout, 'usage: stale-links.mjs <path/to/discovery.md>\n');
  assert.equal(help.stderr, '');
});

test('two links on one line are both reported, with the same line number', async () => {
  const gh = fakeGh(answer);
  const readFile = () => '# Map\nsee https://github.com/o/r/issues/1 and https://github.com/o/r/issues/3\n';
  const { code, stdout } = await runWith(run, ['map.md'], { readFile, execFile: gh.execFile });
  assert.equal(code, 0);
  assert.equal(stdout, '2: #1 Ship: the first story\n2: #3 Third\n');
});

test('findLinks finds every issue link, with its line, in order', () => {
  assert.deepEqual(findLinks('x\nhttps://github.com/o/r/issues/12 https://github.com/a/b/issues/3\n'), [
    { line: 2, repo: 'o/r', number: '12' },
    { line: 2, repo: 'a/b', number: '3' },
  ]);
});
