// The real entry: the commander program. Exits 2 on a usage error, such as
// an unknown flag or command.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';

// The folder above the one that holds this file: lets/ in the repo, and the
// release folder once bundled into bin/lets.
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

// The release's version from its release.json, else 0.0.0-dev.
function version(): string {
  try {
    const release = JSON.parse(readFileSync(join(packageRoot, 'release.json'), 'utf8'));
    return typeof release.version === 'string' ? release.version : '0.0.0-dev';
  } catch {
    return '0.0.0-dev';
  }
}

const program = new Command()
  .name('lets')
  .description('The lets-spec command.')
  .version(version())
  .exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (!(error instanceof CommanderError)) throw error;
  process.exitCode = error.exitCode === 0 ? 0 : 2;
}
