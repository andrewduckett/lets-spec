// Bundle lets-delegate-t3 into one file that any Node 26 runs with no node_modules
// beside it.
//
//   node build.mjs [outfile]     outfile defaults to dist/lets-delegate-t3
import { fileURLToPath } from 'node:url';
import { bundle } from 'resolver-kit/build.mjs';

await bundle({
  entry: fileURLToPath(new URL('src/main.ts', import.meta.url)),
  outfile: process.argv[2] ?? fileURLToPath(new URL('dist/lets-delegate-t3', import.meta.url)),
  program: 'lets-delegate-t3',
});
