import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrubbedEnv, SESSION_MARKERS } from '../../../lets/src/delegate/env.ts';
import { NoFamilyError } from '../../../lets/src/delegate/errors.ts';
import { familiesFromExecutors, pickFamily } from '../../../lets/src/delegate/families.ts';

test('picks the first family in order gpt, claude, gemini that is not the source and is available', () => {
  const available = { gpt: ['gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: [] };
  assert.deepEqual(pickFamily({ sourceFamily: 'claude', available }), { family: 'gpt', model: 'gpt-6.1-sol' });
  assert.deepEqual(pickFamily({ sourceFamily: 'gpt', available }), { family: 'claude', model: 'claude-fable-5-1' });
  assert.deepEqual(pickFamily({ sourceFamily: 'gemini', available }), { family: 'gpt', model: 'gpt-6.1-sol' });
});

test('falls back to the source family', () => {
  assert.deepEqual(pickFamily({ sourceFamily: 'claude', available: { gpt: [], claude: [null], gemini: [] } }), { family: 'claude', model: null });
});

test('throws NoFamilyError when nothing is available', () => {
  assert.throws(() => pickFamily({ sourceFamily: 'claude', available: { gpt: [], claude: [], gemini: [] } }), NoFamilyError);
});

test('headless availability is which executors exist', () => {
  assert.deepEqual(familiesFromExecutors((cmd) => cmd === 'codex' || cmd === 'agy'), { gpt: [null], claude: [], gemini: [null] });
});

test('scrubbedEnv removes every session marker, keeps the rest, and leaves its input alone', () => {
  assert.equal(SESSION_MARKERS.length, 9);
  const env: Record<string, string> = { PATH: '/bin' };
  for (const name of SESSION_MARKERS) env[name] = 'x';
  const before = { ...env };
  assert.deepEqual(scrubbedEnv(env), { PATH: '/bin' });
  assert.deepEqual(env, before);
});
