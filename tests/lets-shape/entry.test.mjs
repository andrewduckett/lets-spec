// The real lets-shape scripts, spawned with the fake gh on PATH. These tests
// prove each entry's wiring, io.mjs, and that each argument reaches gh whole.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { spawnEntry } from './fixtures/fake-gh.mjs';

test('the source backlog.mjs has no mode, and refuses a write before it calls gh', () => {
  const { status, stdout, stderr, log } = spawnEntry('skills/lets-shape/scripts/backlog.mjs', ['set-kind', '7', 'Epic']);
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'backlog.mjs: this copy has no backlog mode. Run the copy lets-sync links into .agents/skills/lets-shape/.\n');
  assert.deepEqual(log, []);
});

test('the real stale-links.mjs reads the map, and looks the issue up through gh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'entry-'));
  try {
    const map = join(dir, 'discovery.md');
    writeFileSync(map, '# Map\n- [one](https://github.com/o/r/issues/1)\n');
    const view = ['issue', 'view', '1', '-R', 'o/r', '--json', 'state,title'];
    const answers = [{ args: view, stdout: JSON.stringify({ state: 'CLOSED', title: 'Ship: the first story' }) }];
    const { status, stdout, stderr, log } = spawnEntry('skills/lets-shape/scripts/stale-links.mjs', [map], answers);
    assert.equal(stderr, '');
    assert.equal(status, 0);
    assert.equal(stdout, '2: #1 Ship: the first story\n');
    assert.deepEqual(log, [view]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
