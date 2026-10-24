// The folder that holds lets's own files: config.yaml, and the t3 resolver's
// token beside it.
import { join } from 'node:path';

// $XDG_CONFIG_HOME/lets, or ~/.config/lets when it is unset or empty.
export function configDir(env: Record<string, string | undefined>, homedir: string): string {
  return join(env.XDG_CONFIG_HOME ? env.XDG_CONFIG_HOME : join(homedir, '.config'), 'lets');
}
