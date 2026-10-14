// A marked block in a text file. Pure: text in, text out.
// Works on arrays of lines, so a body is never read as a regex replacement.

export const RULES = {
  begin: '<!-- BEGIN lets-spec rules. lets-sync rewrites this block: change lets-spec, not this text. -->',
  end: '<!-- END lets-spec rules -->',
  beginPattern: /^<!-- BEGIN lets-spec rules/,
  endPattern: /^<!-- END lets-spec rules -->$/,
};

export const SKILLS = {
  begin: '# BEGIN lets-spec skills. lets-sync rewrites this block: change lets-spec, not this text.',
  end: '# END lets-spec skills',
  beginPattern: /^# BEGIN lets-spec skills/,
  endPattern: /^# END lets-spec skills$/,
};

// The section older releases kept in .git/info/exclude.
export const LEGACY_LINKS = {
  begin: '# BEGIN lets-spec links. lets-sync rewrites this section.',
  end: '# END lets-spec links',
  beginPattern: /^# BEGIN lets-spec links/,
  endPattern: /^# END lets-spec links$/,
};

export const SKILLS_BODY = '/.agents/skills/lets-*\n/.agents/skills/openspec-*\n/openspec/schemas/lets-*\n';

// The block as written to a file: begin, body, end, each ending in a newline.
export function renderBlock(markers, body) {
  const text = body === '' || body.endsWith('\n') ? body : `${body}\n`;
  return `${markers.begin}\n${text}${markers.end}\n`;
}

// The lines of a text, without the empty piece after a final newline.
function linesOf(text) {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function joinLines(lines) {
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

// The marker lines in order: [{ index, kind: 'b' | 'e' }].
function markerLines(markers, lines) {
  const found = [];
  lines.forEach((line, index) => {
    if (markers.beginPattern.test(line)) found.push({ index, kind: 'b' });
    if (markers.endPattern.test(line)) found.push({ index, kind: 'e' });
  });
  return found;
}

// Where the block is: none, a pair with its { from, to } line indexes, or unpaired.
function locate(markers, lines) {
  const found = markerLines(markers, lines);
  if (found.length === 0) return { kind: 'none' };
  if (found.length === 2 && found[0].kind === 'b' && found[1].kind === 'e') {
    return { kind: 'pair', from: found[0].index, to: found[1].index };
  }
  return { kind: 'unpaired' };
}

// absent: no text. missing: no markers. unpaired: markers other than one
// begin then one end. Otherwise current or stale.
export function blockState(markers, text, block) {
  if (text === null) return 'absent';
  const lines = linesOf(text);
  const at = locate(markers, lines);
  if (at.kind === 'none') return 'missing';
  if (at.kind === 'unpaired') return 'unpaired';
  const have = lines.slice(at.from, at.to + 1);
  const want = linesOf(block);
  const same = have.length === want.length && have.every((line, i) => line === want[i]);
  return same ? 'current' : 'stale';
}

// The state, and the text once the block is applied.
export function applyBlock(markers, text, block) {
  const state = blockState(markers, text, block);
  switch (state) {
    case 'absent':
      return { state, text: block };
    case 'missing': {
      const ended = text === '' || text.endsWith('\n') ? text : `${text}\n`;
      return { state, text: `${ended}\n${block}` };
    }
    case 'stale': {
      const lines = linesOf(text);
      const at = locate(markers, lines);
      const next = [...lines.slice(0, at.from), ...linesOf(block), ...lines.slice(at.to + 1)];
      return { state, text: joinLines(next) };
    }
    default:
      return { state, text };
  }
}

// The lines between a pair of markers, or null when there is no pair.
export function blockLines(markers, text) {
  if (text === null) return null;
  const lines = linesOf(text);
  const at = locate(markers, lines);
  return at.kind === 'pair' ? lines.slice(at.from + 1, at.to) : null;
}

// The text without the block, and without the one blank line before it that
// applyBlock adds. text is null when nothing else was there.
export function removeBlock(markers, text) {
  if (text === null) return { removed: false, text: null };
  const lines = linesOf(text);
  const at = locate(markers, lines);
  if (at.kind !== 'pair') return { removed: false, text };
  const from = at.from > 0 && lines[at.from - 1] === '' ? at.from - 1 : at.from;
  const rest = [...lines.slice(0, from), ...lines.slice(at.to + 1)];
  return { removed: true, text: rest.length === 0 ? null : joinLines(rest) };
}
