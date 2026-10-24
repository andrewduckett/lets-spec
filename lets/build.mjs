// Bundle lets and every resolver, each into one file that any Node 26 runs
// with no node_modules beside it. This is the one bundle script. Run it from
// the lets folder:
//
//   node build.mjs [folder]
//
// It bundles each entry below into folder/<program>, and folder defaults to
// dist. Each banner repeats the Node check in the program's dev entry, and
// defines require for the CommonJS packages in a bundle, such as yaml, which
// require Node's own modules.
import { chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const entries = [
  ['lets', 'src/main.ts'],
  ['lets-delegate-t3', 'src/resolvers/t3/main.ts'],
  ['lets-delegate-cli', 'src/resolvers/cli/main.ts'],
  ['lets-delegate-subagent', 'src/resolvers/subagent/main.ts'],
];
const folder = resolve(process.argv[2] ?? 'dist');

for (const [program, entry] of entries) {
  const outfile = join(folder, program);
  const banner = `#!/usr/bin/env node
import { createRequire as __letsCreateRequire } from 'node:module';
const require = __letsCreateRequire(import.meta.url);
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
