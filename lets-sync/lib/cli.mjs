// The real entry. Builds deps from the real world, runs lib/main.mjs and
// exits with its code.
import { fileURLToPath } from 'node:url';
import { realIo } from './io.mjs';
import { run } from './main.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

const deps = {
  env: process.env,
  cwd: process.cwd(),
  packageRoot,
  io: realIo(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const code = await run(process.argv.slice(2), deps);
// Let piped output drain before exiting.
await new Promise((resolve) => process.stdout.write('', resolve));
await new Promise((resolve) => process.stderr.write('', resolve));
process.exit(code);
