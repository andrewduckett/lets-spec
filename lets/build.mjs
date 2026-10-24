// Bundle the CLI into one file that any Node 26 runs with no node_modules
// beside it. The banner repeats the Node check in bin/lets, and defines
// require for the CommonJS packages in the bundle, such as yaml, which
// require Node's own modules.
//
//   node build.mjs [outfile]     outfile defaults to dist/lets
import { chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const outfile = process.argv[2] ?? fileURLToPath(new URL('dist/lets', import.meta.url));

const banner = `#!/usr/bin/env node
import { createRequire as __letsCreateRequire } from 'node:module';
const require = __letsCreateRequire(import.meta.url);
if (Number(process.versions.node.split('.')[0]) < 26) {
  process.stderr.write(\`lets: needs Node 26 or later, and this is Node \${process.versions.node}.\\n\`);
  process.exit(1);
}`;

await build({
  entryPoints: [fileURLToPath(new URL('src/main.ts', import.meta.url))],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  banner: { js: banner },
  logLevel: 'warning',
});
chmodSync(outfile, 0o755);
