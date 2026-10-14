import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseAdapter, HARNESSES } from '../../skills/spawn-session/scripts/lib/harness.mjs';
import { UsageError } from '../../skills/spawn-session/scripts/lib/errors.mjs';

function adapter(name, detects, log = []) {
  return { name, detect: () => { log.push(name); return detects; } };
}

test('the harnesses are t3, herdr and none', () => {
  assert.deepEqual(HARNESSES, ['t3', 'herdr', 'none']);
});
test('the override wins over a detecting adapter', () => {
  const adapters = { t3: adapter('t3', true), herdr: adapter('herdr', false), none: adapter('none', true) };
  assert.equal(chooseAdapter({ env: { LETS_SPEC_HARNESS: 'herdr' }, adapters }).name, 'herdr');
});
test('an unknown override is a usage error', () => {
  const adapters = { t3: adapter('t3', false), herdr: adapter('herdr', false), none: adapter('none', true) };
  assert.throws(() => chooseAdapter({ env: { LETS_SPEC_HARNESS: 'fake' }, adapters }), UsageError);
});
test('t3 beats herdr when both detect, and herdr is not asked', () => {
  const log = [];
  const adapters = { t3: adapter('t3', true, log), herdr: adapter('herdr', true, log), none: adapter('none', true, log) };
  assert.equal(chooseAdapter({ env: {}, adapters }).name, 't3');
  assert.deepEqual(log, ['t3']);
});
test('herdr when only herdr detects', () => {
  const adapters = { t3: adapter('t3', false), herdr: adapter('herdr', true), none: adapter('none', true) };
  assert.equal(chooseAdapter({ env: {}, adapters }).name, 'herdr');
});
test('none when neither detects', () => {
  const adapters = { t3: adapter('t3', false), herdr: adapter('herdr', false), none: adapter('none', true) };
  assert.equal(chooseAdapter({ env: {}, adapters }).name, 'none');
});
