#!/usr/bin/env node
// Start a fresh agent session in the harness this one runs in. Run with
// --help for the commands. lib/main.mjs holds the flow; this file wires it to
// the real world.

// Check the version before loading anything that needs node:sqlite.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  process.stderr.write(`spawn-session: Node 22.13 or later is required (found v${process.versions.node})\n`);
  process.exit(2);
}

const { realIo } = await import('./lib/io.mjs');
const { run } = await import('./lib/main.mjs');
const { SpawnError } = await import('./lib/errors.mjs');

// Stand-ins until each adapter exists: they never detect and refuse to spawn.
function stubAdapter(name) {
  const refuse = async () => { throw new SpawnError('not implemented'); };
  return {
    name,
    detect: () => false,
    availableFamilies: () => { throw new SpawnError('not implemented'); },
    spawn: refuse,
    waitForResult: refuse,
    finish: async () => {},
  };
}

const io = realIo();
const deps = {
  env: process.env,
  cwd: process.cwd(),
  adapters: { t3: stubAdapter('t3'), herdr: stubAdapter('herdr'), none: stubAdapter('none') },
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  readFile: io.readFile,
  execFile: io.execFile,
  now: io.now,
  sleep: io.sleep,
};

const code = await run(process.argv.slice(2), deps);
// Let piped output drain before exiting.
await new Promise((resolve) => process.stdout.write('', resolve));
await new Promise((resolve) => process.stderr.write('', resolve));
process.exit(code);
