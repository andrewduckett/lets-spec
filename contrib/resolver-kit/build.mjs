// Bundle a resolver program into one file that any Node 26 runs with no
// node_modules beside it. Each program's build.mjs calls this with its own
// entry. The banner repeats the Node check in the program's bin/ entry.
import { chmodSync } from 'node:fs';
import { build } from 'esbuild';

export async function bundle({ entry, outfile, program }) {
  const banner = `#!/usr/bin/env node
if (Number(process.versions.node.split('.')[0]) < 26) {
  process.stderr.write(\`${program}: needs Node 26 or later, and this is Node \${process.versions.node}.\\n\`);
  process.exit(1);
}`;

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node26',
    banner: { js: banner },
    logLevel: 'warning',
  });
  chmodSync(outfile, 0o755);
}
