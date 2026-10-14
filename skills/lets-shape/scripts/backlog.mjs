#!/usr/bin/env node
// Set the kind and priority of the project's issues on GitHub. Run with
// --help for the commands. lib/main.mjs holds the flow; this file wires it to
// the real world.
import { execFile } from './lib/io.mjs';
import { run } from './lib/main.mjs';

// labels or fields: how the repo records kind and priority. The release
// build writes it from the project's backlog choice.
const MODE = '@backlog-mode@';

const code = await run(process.argv.slice(2), {
  mode: MODE,
  execFile,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
// Let piped output drain before exiting.
await new Promise((resolve) => process.stdout.write('', resolve));
await new Promise((resolve) => process.stderr.write('', resolve));
process.exit(code);
