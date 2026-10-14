import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickReviewer, familiesFromT3Manifest, familiesFromExecutors, t3ModelSelection } from '../../skills/lets-spawn/scripts/lib/reviewer.mjs';
import { NoReviewerError } from '../../skills/lets-spawn/scripts/lib/errors.mjs';

test('picks the first family in order gpt, claude, gemini that is not the author and is available', () => {
  const available = { gpt: ['gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: [] };
  assert.deepEqual(pickReviewer({ author: 'claude', available }), { family: 'gpt', model: 'gpt-6.1-sol', independent: true });
  assert.deepEqual(pickReviewer({ author: 'gpt', available }), { family: 'claude', model: 'claude-fable-5-1', independent: true });
  assert.deepEqual(pickReviewer({ author: 'gemini', available }), { family: 'gpt', model: 'gpt-6.1-sol', independent: true });
});
test('falls back to the author family and marks it not independent', () => {
  assert.deepEqual(pickReviewer({ author: 'claude', available: { gpt: [], claude: [null], gemini: [] } }),
    { family: 'claude', model: null, independent: false });
});
test('throws NoReviewerError when nothing is available', () => {
  assert.throws(() => pickReviewer({ author: 'claude', available: { gpt: [], claude: [], gemini: [] } }), NoReviewerError);
});
test('reads current models from the t3 manifest, gemini by effort suffix', () => {
  const manifest = { manifest: { currentModels: {
    codex: ['gpt-6-astra', 'gpt-6.1-sol'], claudeAgent: ['claude-fable-5-1'],
    antigravity: ['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'] } } };
  assert.deepEqual(familiesFromT3Manifest(manifest, 'medium'),
    { gpt: ['gpt-6-astra', 'gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: ['gemini-3.8-flash-medium', 'gemini-3.8-flash-high', 'gemini-3.8-flash-low'] });
  assert.deepEqual(familiesFromT3Manifest({ manifest: { currentModels: {} } }, 'high'), { gpt: [], claude: [], gemini: [] });
});
test('headless availability is which executors exist', () => {
  const exists = (c) => c === 'codex' || c === 'agy';
  assert.deepEqual(familiesFromExecutors(exists), { gpt: [null], claude: [], gemini: [null] });
});
test('t3 model selection carries the effort in each provider\'s own option', () => {
  assert.deepEqual(t3ModelSelection({ family: 'gpt', model: 'gpt-6.1-sol', effort: 'high' }),
    { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] });
  assert.deepEqual(t3ModelSelection({ family: 'claude', model: 'claude-fable-5-1', effort: 'low' }),
    { instanceId: 'claudeAgent', model: 'claude-fable-5-1', options: [{ id: 'effort', value: 'low' }] });
  assert.deepEqual(t3ModelSelection({ family: 'gemini', model: 'gemini-3.8-flash-high', effort: 'high' }),
    { instanceId: 'antigravity', model: 'gemini-3.8-flash-high', options: [] });
});
