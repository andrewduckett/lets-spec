// The t3 resolver through lets delegate: each command with the real T3
// adapter, on the kit's fake io, named in the config.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run as instructions } from '../../../../lets/src/delegate/instructions.ts';
import { parentPid } from '../../../../lets/src/resolvers/kit/io.ts';
import type { Io } from '../../../../lets/src/resolvers/kit/io.ts';
import { createAdapter } from '../../../../lets/src/resolvers/t3/t3.ts';
import { commandDeps } from '../../delegate/fixtures/command-deps.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';

const ONLY_T3 = 'version: 2\nresolvers: [t3]\n';
const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
const MANIFEST = '/home/u/.t3/userdata/model-manifest.json';

// commandDeps whose config lists only t3, the real T3 adapter on io.
const withT3 = (io: Io) => commandDeps({ config: ONLY_T3, real: { t3: createAdapter(io) } });

// This process is 100, and the T3 server is 7.
const io = (parents: Record<number, number>) => fakeIo({
  files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: 'http://127.0.0.1:3773' }) },
  pid: 100,
  parentPid: (pid) => parents[pid] ?? null,
  processAlive: (pid) => pid === 7,
  env: {},
});
const insideT3 = () => io({ 100: 50, 50: 7, 7: 1 });

const reviewInstructions = { strategy: 'review', for: 'code' } as const;

// What review instructions answer inside T3 Code when T3 has no model
// manifest: t3, no options, and a warning that names the manifest.
async function answersWithNoManifest(adapterIo: Io) {
  const t = withT3(adapterIo);
  assert.equal(await instructions(reviewInstructions, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'review', for: 'code', resolver: 't3', options: [], guidance: null });
  assert.ok(t.stderr().includes(MANIFEST), t.stderr());
}

test('review instructions inside T3 Code with no model manifest list no options, and warn with the manifest\'s path', async () => {
  await answersWithNoManifest(insideT3());
});

test('review instructions inside T3 Code on a system with no /proc find the T3 server with ps', async () => {
  const parents: Record<string, string> = { 100: '   50\n', 50: '    7\n', 7: '    1\n' };
  // No file exists, as on macOS, and ps prints each process's parent.
  const sys = {
    readFileSync(path: string): string {
      throw new Error(`ENOENT: ${path}`);
    },
    existsSync: () => false,
    spawnSync: (_cmd: string, args: string[]) => ({ stdout: parents[args.at(-1)!] ?? '' }),
  };
  await answersWithNoManifest({ ...insideT3(), parentPid: (pid: number) => parentPid(pid, sys) });
});

test('review instructions decline when the running T3 server is not an ancestor', async () => {
  const t = withT3(io({ 100: 50, 50: 1 }));
  assert.equal(await instructions(reviewInstructions, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /every resolver declined/);
});
