// The real backlog.mjs, spawned with the fake gh on PATH. These tests prove
// the entry's wiring, io.mjs, and that each argument reaches gh whole.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnEntry } from './fixtures/fake-gh.mjs';

const ENTRY = 'skills/lets-build/scripts/backlog.mjs';

test('the real script runs next through gh, passing the query as one argument', () => {
  const search = ['api', '--paginate', '--slurp', '-X', 'GET', 'search/issues', '-f', 'advanced_search=true', '-f', 'per_page=100',
    '-f', 'q=repo:o/r is:issue is:open no:assignee -is:blocked -label:kind/epic -type:Epic'];
  const answers = [
    { args: ['api', 'repos/{owner}/{repo}', '--jq', '.full_name'], stdout: 'o/r\n' },
    { args: search, stdout: JSON.stringify([{ items: [{ number: 4, title: 'story-4', html_url: 'u4', labels: [{ name: 'priority/should' }] }] }]) },
  ];
  const { status, stdout, stderr, log } = spawnEntry(ENTRY, ['next'], answers);
  assert.equal(stderr, '');
  assert.equal(status, 0);
  assert.equal(stdout, '#4 [should] story-4\nu4\n');
  assert.deepEqual(log, [answers[0].args, search]);
});

test('the real script exits 1 with the usage when given no command', () => {
  const { status, stdout, stderr, log } = spawnEntry(ENTRY, []);
  assert.equal(status, 1);
  assert.match(stdout, /^backlog\.mjs: pick and claim/);
  assert.equal(stderr, '');
  assert.deepEqual(log, []);
});
