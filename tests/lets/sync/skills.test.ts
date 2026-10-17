import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { realIo } from '../../../lets/src/io.ts';
import { checkSkills, syncSkills } from '../../../lets/src/sync/skills.ts';
import type { FakeIo } from './fixtures/fake-io.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const SCHEMA = 'lets-standard';
const SRC = '/rel/overlay/.agents/skills/lets-build';

function release(extra = {}) {
  const io = fakeIo({ files: {
    [`${SRC}/SKILL.md`]: 'skill',
    [`${SRC}/scripts/backlog.sh`]: '#!/bin/sh\n',
    [`/rel/overlay/openspec/schemas/${SCHEMA}/schema.yaml`]: 'schema',
    ...extra,
  } });
  // The Nix store is read-only.
  io.modes.set(`${SRC}/SKILL.md`, 0o444);
  io.modes.set(`${SRC}/scripts/backlog.sh`, 0o555);
  return io;
}

function sync(io: FakeIo) {
  const out: string[] = [];
  const result = syncSkills({ release: '/rel', schemaName: SCHEMA, root: '/p', io, stdout: (t) => out.push(t) });
  return { result, out: out.join('') };
}

test('a missing managed file is written 0755 when the source is executable, else 0644', () => {
  const io = release();
  const { result, out } = sync(io);
  assert.equal(io.readFile('/p/.agents/skills/lets-build/SKILL.md'), 'skill');
  assert.equal(io.modes.get('/p/.agents/skills/lets-build/SKILL.md'), 0o644);
  assert.equal(io.modes.get('/p/.agents/skills/lets-build/scripts/backlog.sh'), 0o755);
  assert.equal(io.readFile(`/p/openspec/schemas/${SCHEMA}/schema.yaml`), 'schema');
  assert.equal(result.written, 3);
  assert.equal(out, 'lets-spec: wrote 3 files. Commit them.\n');
});

test('a differing managed file is rewritten and counted', () => {
  const io = release();
  sync(io);
  io.writeFile('/p/.agents/skills/lets-build/SKILL.md', 'old');
  const { result, out } = sync(io);
  assert.equal(io.readFile('/p/.agents/skills/lets-build/SKILL.md'), 'skill');
  assert.equal(result.written, 1);
  assert.equal(out, 'lets-spec: wrote 1 files. Commit them.\n');
});

test('a file with the right bytes and no execute bit is rewritten', () => {
  const io = release();
  sync(io);
  io.modes.set('/p/.agents/skills/lets-build/scripts/backlog.sh', 0o644);
  const { result } = sync(io);
  assert.equal(result.written, 1);
  assert.equal(io.modes.get('/p/.agents/skills/lets-build/scripts/backlog.sh'), 0o755);
});

test('a mode that differs only in its write or group bits is left alone', () => {
  const io = release();
  sync(io);
  io.modes.set('/p/.agents/skills/lets-build/SKILL.md', 0o664);
  io.modes.set('/p/.agents/skills/lets-build/scripts/backlog.sh', 0o775);
  assert.deepEqual(checkSkills({ release: '/rel', schemaName: SCHEMA, root: '/p', io }), []);
  const { result } = sync(io);
  assert.equal(result.written, 0);
});

test('an identical tree writes nothing and prints nothing', () => {
  const io = release();
  sync(io);
  const { result, out } = sync(io);
  assert.deepEqual(result, { written: 0, removed: [] });
  assert.equal(out, '');
});

test('a file the release no longer has under a managed path is removed', () => {
  const io = release();
  sync(io);
  io.writeFile('/p/.agents/skills/lets-build/old.md', 'gone');
  const { result } = sync(io);
  assert.equal(io.exists('/p/.agents/skills/lets-build/old.md'), false);
  assert.equal(result.written, 0);
});

test('a managed path the release does not ship is removed and reported', () => {
  const io = release({ '/p/.agents/skills/lets-old/SKILL.md': 'x', '/p/openspec/schemas/lets-old/schema.yaml': 'y' });
  io.links.set('/p/.agents/skills/openspec-gone', '/store/a-lets-spec-release/b');
  const { result, out } = sync(io);
  assert.deepEqual(result.removed, [
    '.agents/skills/lets-old',
    '.agents/skills/openspec-gone',
    'openspec/schemas/lets-old',
  ]);
  assert.equal(io.exists('/p/.agents/skills/lets-old'), false);
  assert.equal(io.isSymlink('/p/.agents/skills/openspec-gone'), false);
  assert.match(out, /^lets-spec: removed \.agents\/skills\/lets-old\.$/m);
  assert.match(out, /^lets-spec: removed openspec\/schemas\/lets-old\.$/m);
});

test('a symlink at a managed path is replaced by files', () => {
  const io = release();
  io.links.set('/p/.agents/skills/lets-build', '/store/a-lets-spec-release/overlay/.agents/skills/lets-build');
  const { result } = sync(io);
  assert.equal(io.isSymlink('/p/.agents/skills/lets-build'), false);
  assert.equal(io.readFile('/p/.agents/skills/lets-build/SKILL.md'), 'skill');
  assert.equal(result.written, 3);
});

test('a managed path the release does not ship but is not ours by name is kept', () => {
  const io = release({ '/p/.agents/skills/brainstorming/SKILL.md': 'mine' });
  const { result } = sync(io);
  assert.equal(io.readFile('/p/.agents/skills/brainstorming/SKILL.md'), 'mine');
  assert.deepEqual(result.removed, []);
});

test('checkSkills names each stale, missing or extra file', () => {
  const io = release();
  assert.deepEqual(checkSkills({ release: '/rel', schemaName: SCHEMA, root: '/p', io }), [
    'lets-spec: .agents/skills/lets-build/SKILL.md is out of date. Run lets sync, then commit it.',
    'lets-spec: .agents/skills/lets-build/scripts/backlog.sh is out of date. Run lets sync, then commit it.',
    `lets-spec: openspec/schemas/${SCHEMA}/schema.yaml is out of date. Run lets sync, then commit it.`,
  ]);
  sync(io);
  assert.deepEqual(checkSkills({ release: '/rel', schemaName: SCHEMA, root: '/p', io }), []);
  io.writeFile('/p/.agents/skills/lets-build/SKILL.md', 'edited');
  io.writeFile('/p/.agents/skills/lets-build/extra.md', 'x');
  io.writeFile('/p/.agents/skills/lets-old/SKILL.md', 'x');
  assert.deepEqual(checkSkills({ release: '/rel', schemaName: SCHEMA, root: '/p', io }), [
    'lets-spec: .agents/skills/lets-build/SKILL.md is out of date. Run lets sync, then commit it.',
    'lets-spec: .agents/skills/lets-build/extra.md is out of date. Run lets sync, then commit it.',
    'lets-spec: .agents/skills/lets-old is out of date. Run lets sync, then commit it.',
  ]);
});

test('on disk, a read-only script is copied 755 and runs, a read-only file 644, and a copy can be updated', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lets-skills-'));
  try {
    const src = join(dir, 'rel/overlay/.agents/skills/lets-build');
    mkdirSync(join(src, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'rel/overlay/openspec/schemas', SCHEMA), { recursive: true });
    writeFileSync(join(dir, 'rel/overlay/openspec/schemas', SCHEMA, 'schema.yaml'), 's');
    const script = join(src, 'scripts/backlog.sh');
    writeFileSync(script, '#!/usr/bin/env bash\necho one\n');
    chmodSync(script, 0o555);
    const doc = join(src, 'SKILL.md');
    writeFileSync(doc, 'skill\n');
    chmodSync(doc, 0o444);
    const root = join(dir, 'proj');
    mkdirSync(root);
    const args = { release: join(dir, 'rel'), schemaName: SCHEMA, root, io: realIo(), stdout: () => {} };
    syncSkills(args);
    const copy = join(root, '.agents/skills/lets-build/scripts/backlog.sh');
    assert.equal(statSync(copy).mode & 0o777, 0o755);
    assert.equal(statSync(join(root, '.agents/skills/lets-build/SKILL.md')).mode & 0o777, 0o644);
    assert.deepEqual(checkSkills(args), []);
    assert.equal(execFileSync('bash', [copy]).toString(), 'one\n');
    chmodSync(script, 0o755);
    writeFileSync(script, '#!/usr/bin/env bash\necho two\n');
    chmodSync(script, 0o555);
    syncSkills(args);
    assert.equal(statSync(copy).mode & 0o777, 0o755);
    assert.equal(readFileSync(copy, 'utf8'), '#!/usr/bin/env bash\necho two\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A release with one skill whose script sits in a subfolder, and a project.
function onDisk(dir: string) {
  const src = join(dir, 'rel/overlay/.agents/skills/lets-build');
  mkdirSync(join(src, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'rel/overlay/openspec/schemas', SCHEMA), { recursive: true });
  writeFileSync(join(dir, 'rel/overlay/openspec/schemas', SCHEMA, 'schema.yaml'), 's');
  writeFileSync(join(src, 'scripts/backlog.sh'), 'new\n');
  chmodSync(join(src, 'scripts/backlog.sh'), 0o755);
  const root = join(dir, 'proj');
  mkdirSync(join(root, '.agents/skills/lets-build'), { recursive: true });
  return { root, args: { release: join(dir, 'rel'), schemaName: SCHEMA, root, io: realIo(), stdout: () => {} } };
}

test('on disk, a folder link inside a managed path is replaced, and its target is left alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lets-skills-'));
  try {
    const { root, args } = onDisk(dir);
    mkdirSync(join(dir, 'outside'));
    writeFileSync(join(dir, 'outside/backlog.sh'), 'precious\n');
    symlinkSync('../../../../outside', join(root, '.agents/skills/lets-build/scripts'));
    assert.match(checkSkills(args).join('\n'), /lets-build\/scripts\/backlog\.sh is out of date/);
    const result = syncSkills(args);
    const copy = join(root, '.agents/skills/lets-build/scripts/backlog.sh');
    assert.equal(readFileSync(join(dir, 'outside/backlog.sh'), 'utf8'), 'precious\n');
    assert.equal(lstatSync(join(root, '.agents/skills/lets-build/scripts')).isDirectory(), true);
    assert.equal(readFileSync(copy, 'utf8'), 'new\n');
    assert.equal(statSync(copy).mode & 0o777, 0o755);
    assert.equal(result.written, 2);
    assert.deepEqual(checkSkills(args), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('on disk, a dangling folder link inside a managed path is replaced', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lets-skills-'));
  try {
    const { root, args } = onDisk(dir);
    symlinkSync('/nonexistent/gone', join(root, '.agents/skills/lets-build/scripts'));
    syncSkills(args);
    const copy = join(root, '.agents/skills/lets-build/scripts/backlog.sh');
    assert.equal(readFileSync(copy, 'utf8'), 'new\n');
    assert.equal(statSync(copy).mode & 0o777, 0o755);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('on disk, a folder where the release has a file is out of date, then replaced by the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lets-skills-'));
  try {
    const { root, args } = onDisk(dir);
    mkdirSync(join(root, '.agents/skills/lets-build/scripts/backlog.sh'), { recursive: true });
    writeFileSync(join(root, '.agents/skills/lets-build/scripts/backlog.sh/inside'), 'x\n');
    assert.match(checkSkills(args).join('\n'), /lets-build\/scripts\/backlog\.sh is out of date/);
    syncSkills(args);
    const copy = join(root, '.agents/skills/lets-build/scripts/backlog.sh');
    assert.equal(readFileSync(copy, 'utf8'), 'new\n');
    assert.equal(statSync(copy).mode & 0o777, 0o755);
    assert.deepEqual(checkSkills(args), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
