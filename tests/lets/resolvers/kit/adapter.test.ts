import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TIMEOUT_MINUTES, normalizeName } from '../../../../lets/src/resolvers/kit/adapter.ts';

test('a session\'s default time limit depends on its effort', () => {
  assert.deepEqual(DEFAULT_TIMEOUT_MINUTES, { low: 15, medium: 15, high: 45 });
});

test('names are normalized, not refused', () => {
  assert.equal(normalizeName('Add CSV Parser Tests'), 'add-csv-parser-tests');
  assert.equal(normalizeName('9lives'), 'x9lives');
  assert.equal(normalizeName('a'.repeat(40)).length, 32);
  assert.equal(normalizeName('weird__name--'), 'weird__name');
  assert.equal(normalizeName('My Change'), 'my-change');
});
