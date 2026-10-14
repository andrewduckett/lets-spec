import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkClaude, createInitFiles, linkClaude } from '../../lets-sync/lib/init.mjs';
import { fakeIo } from './fixtures/fake-io.mjs';

test('each missing init file is copied and named, and an existing one is kept', () => {
  const io = fakeIo({ files: {
    '/rel/init/openspec/config.yaml': 'schema: lets-standard\n',
    '/rel/init/docs/note.md': 'note',
    '/p/docs/note.md': 'mine',
  } });
  io.modes.set('/rel/init/openspec/config.yaml', 0o444);
  const out = [];
  createInitFiles({ release: '/rel', root: '/p', io, stdout: (t) => out.push(t) });
  assert.equal(io.readFile('/p/openspec/config.yaml'), 'schema: lets-standard\n');
  assert.equal(io.modes.get('/p/openspec/config.yaml'), 0o644);
  assert.equal(io.readFile('/p/docs/note.md'), 'mine');
  assert.equal(out.join(''), 'lets-spec: created openspec/config.yaml.\n');
});

test('linkClaude links both paths once and says so', () => {
  const io = fakeIo();
  const out = [];
  linkClaude({ root: '/p', io, stdout: (t) => out.push(t) });
  assert.equal(io.readlink('/p/CLAUDE.md'), 'AGENTS.md');
  assert.equal(io.readlink('/p/.claude/skills'), '../.agents/skills');
  assert.equal(out.join(''),
    'lets-spec: linked CLAUDE.md to AGENTS.md.\nlets-spec: linked .claude/skills to ../.agents/skills.\n');
  linkClaude({ root: '/p', io, stdout: (t) => out.push(t) });
  assert.equal(out.length, 2);
});

test('checkClaude warns about each link that is wrong', () => {
  const io = fakeIo({ files: { '/p/CLAUDE.md': 'own' } });
  assert.deepEqual(checkClaude({ root: '/p', io }), [
    'CLAUDE.md is not a link to AGENTS.md. Move its text into AGENTS.md, then run: ln -sf AGENTS.md CLAUDE.md',
    '.claude/skills is not a link to ../.agents/skills. Move its skills into .agents/skills, then run: rm -r .claude/skills && ln -s ../.agents/skills .claude/skills',
  ]);
  const ok = fakeIo();
  linkClaude({ root: '/p', io: ok, stdout: () => {} });
  assert.deepEqual(checkClaude({ root: '/p', io: ok }), []);
});
