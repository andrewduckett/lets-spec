import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseModel } from '../../../../lets/src/resolvers/kit/families.ts';

test('parseModel splits a model string at its first slash', () => {
  assert.deepEqual(parseModel('gpt/gpt-6-luna'), { family: 'gpt', model: 'gpt-6-luna' });
  assert.deepEqual(parseModel('claude'), { family: 'claude', model: null });
  assert.deepEqual(parseModel('gemini/vendor/gemini-x'), { family: 'gemini', model: 'vendor/gemini-x' });
});

test('parseModel refuses a string that is not <family> or <family>/<id>', () => {
  for (const text of ['', 'llama/llama-4', 'gpt/', 'gpt/gpt 6', '/gpt-6', 'GPT', ' gpt']) {
    assert.equal(parseModel(text), null, JSON.stringify(text));
  }
});
