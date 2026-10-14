import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, normalizeName, USAGE, DEFAULT_TIMEOUT_MINUTES } from '../../skills/lets-spawn/scripts/lib/cli.mjs';
import { UsageError } from '../../skills/lets-spawn/scripts/lib/errors.mjs';

test('detect takes no options', () => {
  assert.deepEqual(parseArgs(['detect']), { command: 'detect' });
});
test('critique with a prompt file and defaults', () => {
  assert.deepEqual(parseArgs(['critique', '--name', 'x-plan-review', '--author', 'claude', '--effort', 'high', '--prompt-file', 'p.md']),
    { command: 'critique', name: 'x-plan-review', author: 'claude', effort: 'high', promptFile: 'p.md', codeReview: null, timeoutMinutes: 45 });
});
test('critique code review mode', () => {
  const p = parseArgs(['critique', '--name', 'x', '--author', 'gpt', '--effort', 'medium', '--code-review', '--base', 'main']);
  assert.deepEqual(p.codeReview, { base: 'main' });
  assert.equal(p.promptFile, null);
  assert.equal(p.timeoutMinutes, 15);
});
test('critique rejects both prompt-file and code-review, and neither', () => {
  assert.throws(() => parseArgs(['critique', '--name', 'x', '--author', 'gpt', '--effort', 'low', '--prompt-file', 'p', '--code-review', '--base', 'main']), UsageError);
  assert.throws(() => parseArgs(['critique', '--name', 'x', '--author', 'gpt', '--effort', 'low']), UsageError);
});
test('critique rejects a bad family, effort, or timeout', () => {
  for (const bad of [['--author', 'openai'], ['--effort', 'max'], ['--timeout', 'soon']]) {
    const argv = ['critique', '--name', 'x', '--author', 'gpt', '--effort', 'low', '--prompt-file', 'p', ...bad];
    assert.throws(() => parseArgs(argv), UsageError);
  }
});
test('handoff defaults and flags', () => {
  assert.deepEqual(parseArgs(['handoff', '--name', 'fix-login', '--prompt', 'Run lets-build on branch fix-login']),
    { command: 'handoff', name: 'fix-login', prompt: 'Run lets-build on branch fix-login', unattended: false, model: null });
  assert.equal(parseArgs(['handoff', '--name', 'a', '--prompt', 'p', '--unattended', '--model', 'claude-sonnet-5-5']).model, 'claude-sonnet-5-5');
});
test('names are normalized, not refused', () => {
  assert.equal(normalizeName('Add CSV Parser Tests'), 'add-csv-parser-tests');
  assert.equal(normalizeName('9lives'), 'x9lives');
  assert.equal(normalizeName('a'.repeat(40)).length, 32);
  assert.equal(normalizeName('weird__name--'), 'weird__name');
  assert.equal(parseArgs(['handoff', '--name', 'My Change', '--prompt', 'p']).name, 'my-change');
});
test('help is a command; unknown commands raise UsageError', () => {
  assert.deepEqual(parseArgs(['--help']), { command: 'help' });
  assert.deepEqual(parseArgs([]), { command: 'help' });
  assert.throws(() => parseArgs(['frobnicate']), UsageError);
  assert.throws(() => parseArgs(['detect', '--bogus']), UsageError);
  assert.match(USAGE, /^usage: lets-spawn <detect\|critique\|handoff>/);
});
test('default timeouts by effort', () => {
  assert.deepEqual(DEFAULT_TIMEOUT_MINUTES, { low: 15, medium: 15, high: 45 });
});
