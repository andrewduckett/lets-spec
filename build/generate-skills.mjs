#!/usr/bin/env node
// Generate the OpenSpec skills for the workflows listed in openspec.json.
// The flake runs it while it builds a release, with the OpenSpec CLI from
// nixpkgs on the PATH.
//
// Usage: generate-skills.mjs <openspec.json> <output folder>
import { spawnSync } from 'node:child_process';
import {
  closeSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function generate(settings, out, work) {
  // The CLI reads profile, delivery and workflows only from its global
  // config, so point XDG_CONFIG_HOME at a copy of openspec.json for this one
  // command. Remove the redirect once the CLI reads those settings from the
  // project:
  // https://github.com/Fission-AI/OpenSpec/issues/914
  // https://github.com/Fission-AI/OpenSpec/issues/779
  const project = join(work, 'project');
  mkdirSync(join(work, 'config/openspec'), { recursive: true });
  mkdirSync(project, { recursive: true });
  copyFileSync(settings, join(work, 'config/openspec/config.json'));

  // Generate into an empty scratch project. Send all output to a log: when
  // stderr is a terminal, init can hang on its progress spinner.
  const logPath = join(work, 'init.log');
  const log = openSync(logPath, 'w');
  let init;
  try {
    init = spawnSync('openspec', ['init', '--tools', 'agents', '--no-animation'], {
      cwd: project,
      env: { ...process.env, XDG_CONFIG_HOME: join(work, 'config'), OPENSPEC_TELEMETRY: '0', OPENSPEC_NO_UPDATE_CHECK: '1' },
      stdio: ['ignore', log, log],
    });
  } finally {
    closeSync(log);
  }
  if (init.error || init.status !== 0) {
    process.stderr.write(readFileSync(logPath, 'utf8'));
    if (init.error) process.stderr.write(`${init.error.message}\n`);
    process.stderr.write('error: openspec init failed.\n');
    return 1;
  }

  // Keep only the skill folders. init also writes a marker file and an
  // openspec/ folder, which projects do not need from here.
  mkdirSync(out, { recursive: true });
  const generated = join(project, '.agents/skills');
  let names = [];
  try {
    names = readdirSync(generated).sort()
      .filter((name) => name.startsWith('openspec-') && statSync(join(generated, name)).isDirectory());
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const name of names) cpSync(join(generated, name), join(out, name), { recursive: true });
  if (names.length === 0) {
    process.stderr.write('error: openspec init wrote no openspec-* skills.\n');
    return 1;
  }
  return 0;
}

const args = process.argv.slice(2);
if (args[0] === '-h' || args[0] === '--help') {
  process.stdout.write('usage: generate-skills.mjs <openspec.json> <output folder>\n');
  process.exit(0);
}
if (args.length !== 2) {
  process.stderr.write('usage: generate-skills.mjs <openspec.json> <output folder>\n');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'generate-skills-'));
let code;
try {
  code = generate(args[0], args[1], work);
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(code);
