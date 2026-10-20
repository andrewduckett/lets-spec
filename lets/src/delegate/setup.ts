// lets delegate setup: find out what this machine can run, propose a
// delegate config from that, and write it on request. It starts no session
// and spends no tokens: it runs only the CLIs' model list commands and looks
// on PATH. No process access here; everything comes through deps.
import type { Io } from '../io.ts';
import type { Env } from './env.ts';
import { FAMILIES } from './protocol.ts';
import type { Family } from './protocol.ts';

export const HARNESSES = ['t3', 'herdr'] as const;
// The CLI that runs each family.
export const FAMILY_CLI: Record<Family, string> = { gpt: 'codex', claude: 'claude', gemini: 'agy' };

export type Harness = { name: (typeof HARNESSES)[number] | 'none'; onPath: Record<(typeof HARNESSES)[number], boolean> };
// models: what the account can run, best first; [] when there is no list.
// error: why the list command failed, when it did.
export type FamilyFindings = { cli: string; available: boolean; models: string[]; error?: string };
export type Findings = { harness: Harness; families: Record<Family, FamilyFindings> };

export type DetectDeps = { env: Env; io: Io };

// What this machine offers: the harness this process runs in, and each
// family's CLI.
export async function detect({ env, io }: DetectDeps): Promise<Findings> {
  const onPath = { t3: io.commandExists('t3'), herdr: io.commandExists('herdr') };
  const name = insideT3(env, io) ? 't3' : env.HERDR_ENV === '1' && onPath.herdr ? 'herdr' : 'none';
  const families = {} as Record<Family, FamilyFindings>;
  for (const family of FAMILIES) {
    const cli = FAMILY_CLI[family];
    families[family] = { cli, available: io.commandExists(cli), models: [] };
  }
  return { harness: { name, onPath }, families };
}

// True when the T3 server in T3's runtime file is alive and one of this
// process's parents. The contrib resolver checks the same way, so setup
// works before any resolver is installed.
function insideT3(env: Env, io: Io): boolean {
  const base = env.T3CODE_HOME ?? `${io.homedir()}/.t3`;
  const text = io.readFile(`${base}/userdata/server-runtime.json`);
  if (text === null) return false;
  let pid: unknown;
  try {
    ({ pid } = JSON.parse(text));
  } catch {
    return false;
  }
  if (typeof pid !== 'number' || !io.processAlive(pid)) return false;
  let current: number | null = io.pid;
  // The bound guards against a cycle in a bad parent map.
  for (let hops = 0; current !== null && current > 0 && hops < 4096; hops++) {
    if (current === pid) return true;
    current = io.parentPid(current);
  }
  return false;
}
