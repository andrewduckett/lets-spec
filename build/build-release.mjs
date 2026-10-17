#!/usr/bin/env node
// Build the release for one flow: the files lets-sync copies into a
// project and creates in it. The flake runs it once for each recipe in
// flows.json.
//
// Usage: build-release.mjs <source> <generated> <out> <schemas> [skill...]
//   source     this repo, or a copy of its schemas/, skills/ and overlays/
//              folders
//   generated  a folder that holds the generated openspec-* skills
//   out        the release folder to create
//   schemas    the folders in schemas/ to ship, comma-separated. The first
//              is the default, and names the config
//   skill      each folder in skills/ to ship
//
// The release has three folders:
//   overlay/    files lets-sync copies into a project, at the same
//               paths: the skills and the schemas
//   init/       files lets-sync creates in a project when they are
//               missing
//   fragments/  text lets-sync keeps in a marked block of the project's
//               file at the same path
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, statSync,
} from 'node:fs';
import { join } from 'node:path';

const USAGE = 'usage: build-release.mjs <source> <generated> <out> <schemas> [skill...]';

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
if (args.length < 4) die(USAGE);
const [source, generated, out, schemaList, ...skillNames] = args;
const schemas = schemaList.split(',');

for (const schema of schemas) {
  if (!isDir(join(source, 'schemas', schema))) die(`there is no schema named ${schema} in schemas/.`);
}
if (!isDir(generated)) die(`there is no folder of generated skills at ${generated}.`);
for (const skill of skillNames) {
  if (!isDir(join(source, 'skills', skill))) die(`there is no skill named ${skill} in skills/.`);
}

const overlay = join(out, 'overlay');
const skills = join(overlay, '.agents/skills');
for (const dir of [join(overlay, 'openspec/schemas'), skills, join(out, 'fragments')]) mkdirSync(dir, { recursive: true });
for (const schema of schemas) {
  cpSync(join(source, 'schemas', schema), join(overlay, 'openspec/schemas', schema), { recursive: true });
}
// overlays/ holds the files a project gets, at their paths in the project.
// AGENTS.md is a fragment, and lets-sync creates each other file.
cpSync(join(source, 'overlays'), join(out, 'init'), { recursive: true });
makeWritable(out);
renameSync(join(out, 'init/AGENTS.md'), join(out, 'fragments/AGENTS.md'));

// Each flow has its own config in openspec/config.d/<schema>.yaml: the
// whole file lets-sync creates, naming the flow's schema and holding what
// its projects start with, such as the standard flow's archive guidance.
// The release ships the default schema's as the config, and no project
// gets the folder.
const configs = join(out, 'init/openspec/config.d');
const flowConfig = join(configs, `${schemas[0]}.yaml`);
if (!existsSync(flowConfig)) die(`there is no config for ${schemas[0]} in overlays/openspec/config.d/.`);
renameSync(flowConfig, join(out, 'init/openspec/config.yaml'));
rmSync(configs, { recursive: true, force: true });

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
