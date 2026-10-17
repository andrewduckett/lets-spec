import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isManaged, projectPaths, releasePaths } from '../../../lets/src/sync/managed.ts';
import { fakeIo } from './fixtures/fake-io.ts';

test('lets- skills, openspec- skills and lets- schemas are managed', () => {
  assert.equal(isManaged('.agents/skills/lets-build'), true);
  assert.equal(isManaged('.agents/skills/openspec-propose'), true);
  assert.equal(isManaged('openspec/schemas/lets-standard'), true);
});

test('a project skill of another name is not managed', () => {
  assert.equal(isManaged('.agents/skills/brainstorming'), false);
  assert.equal(isManaged('.agents/skills/lets-build/SKILL.md'), false);
  assert.equal(isManaged('.agents/skills/xlets-build'), false);
  assert.equal(isManaged('openspec/schemas/spec-driven'), false);
  assert.equal(isManaged('openspec/config.yaml'), false);
});

test('releasePaths lists each skill folder and the schema', () => {
  const io = fakeIo({ files: {
    '/rel/overlay/.agents/skills/lets-build/SKILL.md': 'a',
    '/rel/overlay/.agents/skills/openspec-apply/SKILL.md': 'b',
    '/rel/overlay/openspec/schemas/lets-standard/schema.yaml': 'c',
  } });
  assert.deepEqual(releasePaths({ release: '/rel', io }), [
    { dst: '.agents/skills/lets-build', src: '/rel/overlay/.agents/skills/lets-build' },
    { dst: '.agents/skills/openspec-apply', src: '/rel/overlay/.agents/skills/openspec-apply' },
    { dst: 'openspec/schemas/lets-standard', src: '/rel/overlay/openspec/schemas/lets-standard' },
  ]);
});

test('a release that ships an unmanaged name is refused', () => {
  const io = fakeIo({ files: {
    '/rel/overlay/.agents/skills/brainstorming/SKILL.md': 'a',
    '/rel/overlay/openspec/schemas/lets-standard/schema.yaml': 'c',
  } });
  assert.throws(() => releasePaths({ release: '/rel', io }), /brainstorming/);
});

test('projectPaths lists the managed paths that exist, links included', () => {
  const io = fakeIo({ files: {
    '/p/.agents/skills/lets-build/SKILL.md': 'a',
    '/p/.agents/skills/brainstorming/SKILL.md': 'b',
    '/p/openspec/schemas/lets-old/schema.yaml': 'c',
    '/p/openspec/schemas/mine/schema.yaml': 'd',
  } });
  io.links.set('/p/.agents/skills/openspec-apply', '/store/x-lets-spec-release/y');
  assert.deepEqual(projectPaths({ root: '/p', io }), [
    '.agents/skills/lets-build',
    '.agents/skills/openspec-apply',
    'openspec/schemas/lets-old',
  ]);
});

test('projectPaths is empty in a bare project', () => {
  assert.deepEqual(projectPaths({ root: '/p', io: fakeIo() }), []);
});
