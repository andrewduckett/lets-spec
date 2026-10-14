// The real lets-shape scripts, spawned with the fake gh on PATH. These tests
// prove each entry's wiring, io.mjs, and that each argument reaches gh whole.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnEntry } from './fixtures/fake-gh.mjs';

test('the source backlog.mjs has no mode, and refuses a write before it calls gh', () => {
  const { status, stdout, stderr, log } = spawnEntry('skills/lets-shape/scripts/backlog.mjs', ['set-kind', '7', 'Epic']);
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'backlog.mjs: this copy has no backlog mode. Run the copy lets-sync links into .agents/skills/lets-shape/.\n');
  assert.deepEqual(log, []);
});
