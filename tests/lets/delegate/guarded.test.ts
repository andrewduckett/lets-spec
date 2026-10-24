import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guarded } from '../../../lets/src/delegate/guarded.ts';
import { SessionFailed } from '../../../lets/src/resolvers/kit/errors.ts';

// Deps that keep what the command printed on stderr.
function setup() {
  const err: string[] = [];
  return { deps: { stderr: (text: string) => err.push(text) }, stderr: () => err.join('') };
}

test('guarded returns the exit code of the command it runs', async () => {
  const t = setup();
  assert.equal(await guarded(t.deps, async () => 3), 3);
  assert.equal(t.stderr(), '');
});

test('guarded reports an error it knows, and returns its exit code', async () => {
  const t = setup();
  assert.equal(await guarded(t.deps, async () => { throw new SessionFailed('the session ended'); }), 5);
  assert.equal(t.stderr(), 'lets delegate: the session ended\n');
});

test('guarded rethrows an error it does not know', async () => {
  const t = setup();
  await assert.rejects(guarded(t.deps, async () => { throw new TypeError('a bug'); }), TypeError);
  assert.equal(t.stderr(), '');
});
