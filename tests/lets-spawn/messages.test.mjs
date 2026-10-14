import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeReviewMessage } from '../../skills/lets-spawn/scripts/lib/messages.mjs';

test('a claude reviewer in a harness runs its built-in code review', () => {
  assert.equal(codeReviewMessage({ family: 'claude', base: 'main', effort: 'high', harness: 't3' }), '/code-review high main...HEAD');
  assert.equal(codeReviewMessage({ family: 'claude', base: 'dev', effort: 'low', harness: 'herdr' }), '/code-review low dev...HEAD');
});
test('gpt and gemini reviewers get the prose prompt', () => {
  for (const family of ['gpt', 'gemini']) {
    const message = codeReviewMessage({ family, base: 'main', effort: 'high', harness: 't3' });
    assert.match(message, /git diff main\.\.\.HEAD/);
    assert.match(message, /REVIEW\.md/);
  }
});
test('a claude reviewer outside a harness also gets the prose prompt', () => {
  const message = codeReviewMessage({ family: 'claude', base: 'main', effort: 'high', harness: 'none' });
  assert.match(message, /git diff main\.\.\.HEAD/);
  assert.match(message, /REVIEW\.md/);
});
