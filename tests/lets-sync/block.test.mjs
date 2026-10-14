import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEGACY_LINKS,
  RULES,
  SKILLS,
  SKILLS_BODY,
  applyBlock,
  blockState,
  removeBlock,
  renderBlock,
} from '../../lets-sync/lib/block.mjs';

const BODY = 'one\ntwo\n';
const BLOCK = renderBlock(RULES, BODY);

test('absent, missing, current, stale and unpaired are told apart', () => {
  assert.equal(blockState(RULES, null, BLOCK), 'absent');
  assert.equal(blockState(RULES, '# Project\n', BLOCK), 'missing');
  assert.equal(blockState(RULES, '', BLOCK), 'missing');
  assert.equal(blockState(RULES, `# Project\n\n${BLOCK}`, BLOCK), 'current');
  assert.equal(blockState(RULES, `${BLOCK}tail\n`, BLOCK), 'current');
  assert.equal(blockState(RULES, renderBlock(RULES, 'old\n'), BLOCK), 'stale');
  assert.equal(blockState(RULES, `${RULES.begin}\nbody\n`, BLOCK), 'unpaired');
  assert.equal(blockState(RULES, `${RULES.end}\n`, BLOCK), 'unpaired');
  assert.equal(blockState(RULES, `${RULES.end}\n${RULES.begin}\n`, BLOCK), 'unpaired');
  assert.equal(blockState(RULES, `${BLOCK}${BLOCK}`, BLOCK), 'unpaired');
});

test('the begin marker matches as a prefix and the end marker as a whole line', () => {
  const edited = '<!-- BEGIN lets-spec rules. an older wording -->\nold\n<!-- END lets-spec rules -->\n';
  assert.equal(blockState(RULES, edited, BLOCK), 'stale');
  assert.equal(blockState(RULES, `${RULES.begin}\nx\n${RULES.end} \n`, BLOCK), 'unpaired');
});

test('missing appends after a blank line and ends an unterminated last line', () => {
  assert.deepEqual(applyBlock(RULES, '# Project\n', BLOCK), {
    state: 'missing',
    text: `# Project\n\n${BLOCK}`,
  });
  assert.equal(applyBlock(RULES, '# Project', BLOCK).text, `# Project\n\n${BLOCK}`);
  assert.equal(applyBlock(RULES, '', BLOCK).text, `\n${BLOCK}`);
  assert.deepEqual(applyBlock(RULES, null, BLOCK), { state: 'absent', text: BLOCK });
});

test('stale replaces only the lines between the markers', () => {
  const old = `top\n${renderBlock(RULES, 'old\nlines\n')}bottom\n`;
  assert.deepEqual(applyBlock(RULES, old, BLOCK), {
    state: 'stale',
    text: `top\n${BLOCK}bottom\n`,
  });
});

test('current and unpaired return the text unchanged', () => {
  const current = `a\n\n${BLOCK}`;
  assert.deepEqual(applyBlock(RULES, current, BLOCK), { state: 'current', text: current });
  const unpaired = `a\n${RULES.begin}\n`;
  assert.deepEqual(applyBlock(RULES, unpaired, BLOCK), { state: 'unpaired', text: unpaired });
});

test('a body with a backslash and a dollar sign is written byte for byte', () => {
  const body = 'path C:\\new\\table $1 $& $` $\' \\1 \\n\n';
  const block = renderBlock(RULES, body);
  assert.equal(block, `${RULES.begin}\n${body}${RULES.end}\n`);
  const stale = `x\n${renderBlock(RULES, 'old\n')}y\n`;
  assert.equal(applyBlock(RULES, stale, block).text, `x\n${block}y\n`);
  assert.equal(applyBlock(RULES, 'x\n', block).text, `x\n\n${block}`);
  assert.equal(blockState(RULES, `x\n${block}`, block), 'current');
});

test('renderBlock adds the newline a body lacks', () => {
  assert.equal(renderBlock(RULES, 'a'), `${RULES.begin}\na\n${RULES.end}\n`);
  assert.equal(renderBlock(RULES, 'a\n'), `${RULES.begin}\na\n${RULES.end}\n`);
});

test('removeBlock leaves the project lines and nothing else', () => {
  assert.deepEqual(removeBlock(RULES, `# Project\n\n${BLOCK}`), { removed: true, text: '# Project\n' });
  assert.deepEqual(removeBlock(RULES, `top\n${BLOCK}bottom\n`), { removed: true, text: 'top\nbottom\n' });
  assert.deepEqual(removeBlock(RULES, BLOCK), { removed: true, text: null });
  assert.deepEqual(removeBlock(RULES, `\n${BLOCK}`), { removed: true, text: null });
  assert.deepEqual(removeBlock(RULES, '# Project\n'), { removed: false, text: '# Project\n' });
  assert.deepEqual(removeBlock(RULES, null), { removed: false, text: null });
  const unpaired = `a\n${RULES.begin}\n`;
  assert.deepEqual(removeBlock(RULES, unpaired), { removed: false, text: unpaired });
});

test('the skills block renders the three patterns', () => {
  assert.equal(SKILLS.begin, '# BEGIN lets-spec skills. lets-sync rewrites this block: change lets-spec, not this text.');
  assert.equal(SKILLS.end, '# END lets-spec skills');
  assert.equal(
    renderBlock(SKILLS, SKILLS_BODY),
    `${SKILLS.begin}\n/.agents/skills/lets-*\n/.agents/skills/openspec-*\n/openspec/schemas/lets-*\n${SKILLS.end}\n`,
  );
});

test('the marker definitions match the bash script', () => {
  assert.equal(RULES.begin, '<!-- BEGIN lets-spec rules. lets-sync rewrites this block: change lets-spec, not this text. -->');
  assert.equal(RULES.end, '<!-- END lets-spec rules -->');
  assert.equal(LEGACY_LINKS.begin, '# BEGIN lets-spec links. lets-sync rewrites this section.');
  assert.equal(LEGACY_LINKS.end, '# END lets-spec links');
  for (const m of [RULES, SKILLS, LEGACY_LINKS]) {
    assert.ok(m.beginPattern.test(m.begin));
    assert.ok(m.endPattern.test(m.end));
  }
});
