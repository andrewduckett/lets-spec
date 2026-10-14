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
const headless = await import('./adapters/headless.mjs');
const t3 = await import('./adapters/t3.mjs');
const herdr = await import('./adapters/herdr.mjs');

const io = realIo();
const deps = {
  env: process.env,
  cwd: process.cwd(),
  adapters: { t3: t3.createAdapter(io), herdr: herdr.createAdapter(io), none: headless.createAdapter(io) },
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
