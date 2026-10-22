import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Refused, SpawnError } from '../../contrib/resolver-kit/src/errors.ts';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import { Declined, respond } from '../../contrib/resolver-kit/src/verbs.ts';

const probeRequest = JSON.stringify(buildRequest('probe', { cwd: '/r' }));
const PROGRAM = 'lets-delegate-pond';

test('a response is printed as one JSON line with exit 0', async () => {
  const answer = await respond(PROGRAM, 'probe', probeRequest, async () => ({ resolver: 'pond', options: [] }));
  assert.deepEqual(answer, { code: 0, stdout: '{"resolver":"pond","options":[]}\n', stderr: '' });
});

test('a null response prints nothing, with exit 0', async () => {
  const answer = await respond(PROGRAM, 'probe', probeRequest, async () => null);
  assert.deepEqual(answer, { code: 0, stdout: '', stderr: '' });
});

test('answer receives the verb and the parsed request', async () => {
  const seen: unknown[] = [];
  await respond(PROGRAM, 'probe', probeRequest, async (verb, request) => {
    seen.push(verb, request);
    return null;
  });
  assert.deepEqual(seen, ['probe', { protocol: 2, cwd: '/r' }]);
});

test('a kit error is its exit code, with the program\'s name before the message', async () => {
  const cases: [Error, number][] = [[new Refused('none here'), 3], [new SpawnError('none here'), 4]];
  for (const [error, code] of cases) {
    const answer = await respond(PROGRAM, 'probe', probeRequest, async () => {
      throw error;
    });
    assert.deepEqual(answer, { code, stdout: '', stderr: 'lets-delegate-pond: none here\n' }, error.name);
  }
});

test('a malformed request is exit 2, and answer is not called', async () => {
  let called = false;
  const answer = await respond(PROGRAM, 'probe', '{', async () => {
    called = true;
    return null;
  });
  assert.equal(answer.code, 2);
  assert.match(answer.stderr, /^lets-delegate-pond: the request is not JSON/);
  assert.equal(called, false);
});

test('a decline is exit 75, with the program\'s name before its reason', async () => {
  const answer = await respond(PROGRAM, 'probe', probeRequest, async () => {
    throw new Declined('not inside Pond');
  });
  assert.deepEqual(answer, { code: 75, stdout: '', stderr: 'lets-delegate-pond: not inside Pond\n' });
});

test('a warning goes to stderr under the program\'s name, beside the response', async () => {
  const answer = await respond(PROGRAM, 'probe', probeRequest, async (verb, request, warn) => {
    warn('pond is slow');
    return { resolver: 'pond', options: [] };
  });
  assert.deepEqual(answer, { code: 0, stdout: '{"resolver":"pond","options":[]}\n', stderr: 'lets-delegate-pond: pond is slow\n' });
});

test('any other error propagates', async () => {
  await assert.rejects(respond(PROGRAM, 'probe', probeRequest, async () => {
    throw new TypeError('a bug');
  }), TypeError);
});
