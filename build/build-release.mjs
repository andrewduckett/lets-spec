#!/usr/bin/env node
// Build the release for one flow and one backlog: the files lets-sync
// links into a project and creates in it. The flake runs it once for each
// pair of a recipe in flows.json and a backlog, with the skills of both.
//
// Usage: build-release.mjs <source> <generated> <out> <schema> <mode> [skill...]
//   source     this repo, or a copy of its schemas/, skills/ and overlays/
//              folders
//   generated  a folder that holds the generated openspec-* skills
//   out        the release folder to create
//   schema     the folder in schemas/ to ship
//   mode       labels or fields: how the backlog records kind and priority
//   skill      each folder in skills/ to ship
//
// The release has three folders:
//   overlay/    files lets-sync links into a project, at the same
//               paths: the skills and the schema
//   init/       files lets-sync creates in a project when they are
//               missing
//   fragments/  text lets-sync keeps in a marked block of the project's
//               file at the same path
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const USAGE = 'usage: build-release.mjs <source> <generated> <out> <schema> <mode> [skill...]';

function die(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Every entry under dir, dir included, not following links.
function* walk(dir) {
  yield dir;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

// chmod -R u+w: the Nix store is read-only, and so are copies made from it.
function makeWritable(dir) {
  for (const path of walk(dir)) {
    const stat = lstatSync(path);
    if (!stat.isSymbolicLink()) chmodSync(path, (stat.mode & 0o7777) | 0o200);
  }
}

const args = process.argv.slice(2);
if (args[0] === '-h' || args[0] === '--help') {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
if (args.length < 5) die(USAGE);
const [source, generated, out, schema, mode, ...skillNames] = args;

if (!isDir(join(source, 'schemas', schema))) die(`there is no schema named ${schema} in schemas/.`);
if (mode !== 'labels' && mode !== 'fields') die(`the backlog mode must be labels or fields, got '${mode}'.`);
if (!isDir(generated)) die(`there is no folder of generated skills at ${generated}.`);
for (const skill of skillNames) {
  if (!isDir(join(source, 'skills', skill))) die(`there is no skill named ${skill} in skills/.`);
}

const overlay = join(out, 'overlay');
const skills = join(overlay, '.agents/skills');
for (const dir of [join(overlay, 'openspec/schemas'), skills, join(out, 'fragments')]) mkdirSync(dir, { recursive: true });
cpSync(join(source, 'schemas', schema), join(overlay, 'openspec/schemas', schema), { recursive: true });
// overlays/ holds the files a project gets, at their paths in the project.
// AGENTS.md is a fragment, and lets-sync creates each other file.
cpSync(join(source, 'overlays'), join(out, 'init'), { recursive: true });
makeWritable(out);
renameSync(join(out, 'init/AGENTS.md'), join(out, 'fragments/AGENTS.md'));

// The config lets-sync creates names the flow's schema, which
// lets-sync then expects. A flow may also have a fragment in
// openspec/config.d/<schema>.yaml: settings that flow's projects start
// with, such as its archive guidance. The build appends it to the config,
// and no project gets the config.d folder itself.
const config = join(out, 'init/openspec/config.yaml');
const fragments = join(out, 'init/openspec/config.d');
const fragment = join(fragments, `${schema}.yaml`);
let configText = readFileSync(config, 'utf8').replace(/^schema: .*$/gm, `schema: ${schema}`);
if (existsSync(fragment)) configText += `\n${readFileSync(fragment, 'utf8')}`;
writeFileSync(config, configText);
rmSync(fragments, { recursive: true, force: true });

// Each skill is one folder. A name used twice would hide one of them, so the
// build fails instead.
function addSkill(dir, name, clash) {
  if (existsSync(join(skills, name))) die(`${name} ${clash}.`);
  cpSync(dir, join(skills, name), { recursive: true });
}
for (const skill of skillNames) {
  addSkill(join(source, 'skills', skill), skill, 'is listed twice');
}
for (const name of readdirSync(generated).sort()) {
  const dir = join(generated, name);
  if (!name.startsWith('.') && isDir(dir)) addSkill(dir, name, 'has the same name as a generated OpenSpec skill');
}

// A skill's script that writes to the backlog holds @backlog-mode@ where
// the mode goes, so the shipped skill needs nothing from outside it. Write
// through the file, not over it, to keep its permissions. The skills were
// copied from the read-only store, so make them writable first.
makeWritable(skills);
for (const path of walk(skills)) {
  if (!lstatSync(path).isFile()) continue;
  const text = readFileSync(path, 'utf8');
  if (text.includes('@backlog-mode@')) writeFileSync(path, text.replaceAll('@backlog-mode@', mode));
}
