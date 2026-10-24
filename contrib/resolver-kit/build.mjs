// Bundle a program into one file that any Node 26 runs with no node_modules
// beside it. This is the one bundle script for lets and every resolver. Run it
// from the program's folder:
//
//   node node_modules/resolver-kit/build.mjs [outfile]
//
// It bundles src/main.ts into outfile, which defaults to dist/<name>, where
// <name> is name in the folder's package.json. The banner repeats the Node
// check in the program's bin/ entry, and defines require for the CommonJS
// packages in a bundle, such as yaml, which require Node's own modules.
import { chmodSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const program = JSON.parse(readFileSync('package.json', 'utf8')).name;
const outfile = resolve(process.argv[2] ?? `dist/${program}`);

const banner = `#!/usr/bin/env node
import { createRequire as __letsCreateRequire } from 'node:module';
const require = __letsCreateRequire(import.meta.url);
if (Number(process.versions.node.split('.')[0]) < 26) {
  process.stderr.write(\`${program}: needs Node 26 or later, and this is Node \${process.versions.node}.\\n\`);
  process.exit(1);
}`;

await build({
  entryPoints: ['src/main.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  banner: { js: banner },
  logLevel: 'warning',
});
chmodSync(outfile, 0o755);
