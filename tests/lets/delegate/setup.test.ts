import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect } from '../../../lets/src/delegate/setup.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
// The deps detect takes: commands on PATH, a T3 runtime file naming pid 7,
// and a parent chain 100 -> 50 -> 7 -> 1, unless replaced.
function detectDeps({ commands = [] as string[], env = {} as Record<string, string>, files = { [RUNTIME]: '{"pid":7,"origin":"http://127.0.0.1:3773"}' } as Record<string, string>, chain = { 100: 50, 50: 7, 7: 1 } as Record<number, number> } = {}) {
  const io = fakeIo({ commands, files, pid: 100, parentPid: (pid: number) => chain[pid] ?? null, processAlive: (pid: number) => pid === 7 });
  return { env, io };
}

test('the harness is t3 when the T3 server is alive and one of the parents', async () => {
  assert.equal((await detect(detectDeps())).harness.name, 't3');
});

test('the harness is not t3 when the T3 server is not one of the parents', async () => {
  assert.equal((await detect(detectDeps({ chain: { 100: 50, 50: 1 } }))).harness.name, 'none');
});

test('the harness is herdr when HERDR_ENV is 1 and herdr is on PATH', async () => {
  const deps = detectDeps({ files: {}, commands: ['herdr'], env: { HERDR_ENV: '1' } });
  assert.equal((await detect(deps)).harness.name, 'herdr');
});

test('from a plain terminal the harness is none, and says which harness tools are on PATH', async () => {
  const { harness } = await detect(detectDeps({ files: {}, commands: ['t3'] }));
  assert.deepEqual(harness, { name: 'none', onPath: { t3: true, herdr: false } });
});

test('a family is available when its CLI is on PATH', async () => {
  const { families } = await detect(detectDeps({ files: {}, commands: ['codex', 'claude'] }));
  assert.deepEqual([families.gpt.available, families.claude.available, families.gemini.available], [true, true, false]);
  assert.deepEqual([families.gpt.cli, families.claude.cli, families.gemini.cli], ['codex', 'claude', 'agy']);
});
