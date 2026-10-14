#!/usr/bin/env node
// Pick and claim the project's next story on GitHub. Run with --help for the
// commands. lib/main.mjs holds the flow; this file wires it to the real world.
import { execFile } from './lib/io.mjs';
import { run } from './lib/main.mjs';

const code = await run(process.argv.slice(2), {
  execFile,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
// Let piped output drain before exiting.
await new Promise((resolve) => process.stdout.write('', resolve));
await new Promise((resolve) => process.stderr.write('', resolve));
process.exit(code);
