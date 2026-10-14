// The files the project owns: created once from the release, never edited.
import { dirname, join } from 'node:path';

// True when nothing, not even a dangling link, is at the path.
function absent(path, io) {
  return !io.exists(path) && !io.isSymlink(path);
}

// Copy each init/ file the project lacks. Its mode becomes u+w,go+r.
export function createInitFiles({ release, root, io, stdout }) {
  const init = join(release, 'init');
  for (const file of io.listFiles(init)) {
    const to = join(root, file);
    if (!absent(to, io)) continue;
    io.mkdirp(dirname(to));
    io.copyFile(join(init, file), to);
    io.chmod(to, io.stat(to).mode | 0o200 | 0o044);
    stdout(`lets-spec: created ${file}.\n`);
  }
}

// Claude Code reads CLAUDE.md and .claude/skills. Link both to the files
// every other agent reads, unless the project already has its own.
export function linkClaude({ root, io, stdout }) {
  if (absent(join(root, 'CLAUDE.md'), io)) {
    io.symlink('AGENTS.md', join(root, 'CLAUDE.md'));
    stdout('lets-spec: linked CLAUDE.md to AGENTS.md.\n');
  }
  if (absent(join(root, '.claude/skills'), io)) {
    io.mkdirp(join(root, '.claude'));
    io.symlink('../.agents/skills', join(root, '.claude/skills'));
    stdout('lets-spec: linked .claude/skills to ../.agents/skills.\n');
  }
}

// Warnings for the two links when they are not as lets-sync makes them.
export function checkClaude({ root, io }) {
  const warnings = [];
  if (io.readlink(join(root, 'CLAUDE.md')) !== 'AGENTS.md') {
    warnings.push('CLAUDE.md is not a link to AGENTS.md. Move its text into AGENTS.md, then run: ln -sf AGENTS.md CLAUDE.md');
  }
  if (io.readlink(join(root, '.claude/skills')) !== '../.agents/skills') {
    warnings.push('.claude/skills is not a link to ../.agents/skills. Move its skills into .agents/skills, then run: rm -r .claude/skills && ln -s ../.agents/skills .claude/skills');
  }
  return warnings;
}
