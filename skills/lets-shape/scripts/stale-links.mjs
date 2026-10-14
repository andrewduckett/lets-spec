#!/usr/bin/env node
// List the issue links in a discovery map that point at closed issues. Run
// with --help for the usage. lib/stale.mjs holds the flow; this file wires it
// to the real world.
import { execFile, readFile } from './lib/io.mjs';
import { run } from './lib/stale.mjs';

const code = await run(process.argv.slice(2), {
  readFile,
  execFile,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
// Let piped output drain before exiting.
await new Promise((resolve) => process.stdout.write('', resolve));
await new Promise((resolve) => process.stderr.write('', resolve));
process.exit(code);
