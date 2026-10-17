// Bundle the CLI into one file, dist/lets, that any Node 26 runs with no
// node_modules beside it. The banner repeats the Node check in bin/lets.
import { chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const outfile = fileURLToPath(new URL('dist/lets', import.meta.url));

const banner = `#!/usr/bin/env node
if (Number(process.versions.node.split('.')[0]) < 26) {
  process.stderr.write(\`lets: needs Node 26 or later, and this is Node \${process.versions.node}.\\n\`);
  process.exit(1);
}`;

await build({
  entryPoints: [fileURLToPath(new URL('src/cli.ts', import.meta.url))],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  banner: { js: banner },
  logLevel: 'warning',
});
chmodSync(outfile, 0o755);
