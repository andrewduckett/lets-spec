// Command-line parsing. A plain loop over argv, so an unknown flag is a
// UsageError that names it.
import { UsageError } from './errors.mjs';

export const USAGE = `usage: spawn-session <detect|critique|handoff> [options]

spawn-session detect
  Print the harness a spawn would use: t3, herdr or none.

spawn-session critique --name <name> --author <gpt|claude|gemini> --effort <low|medium|high>
    (--prompt-file <path> | --code-review --base <ref>) [--timeout <minutes>]
  Start a read-only reviewer from another model family and wait for it.
  stdout: the reviewer's final message. stderr: one JSON line about the run.

spawn-session handoff --name <name> --prompt <text> [--unattended] [--model <id>]
  Start a fresh session with the prompt and return at once.
  stdout: one JSON line with the harness and the thread id.

Set LETS_SPEC_HARNESS to t3, herdr or none to skip detection.
`;

export const FAMILIES = ['gpt', 'claude', 'gemini'];
export const EFFORTS = ['low', 'medium', 'high'];
export const DEFAULT_TIMEOUT_MINUTES = { low: 15, medium: 15, high: 45 };

const COMMANDS = ['detect', 'critique', 'handoff'];

// The flags each command takes. true: the flag takes a value.
const FLAGS = {
  detect: {},
  critique: { '--name': true, '--author': true, '--effort': true, '--prompt-file': true, '--code-review': false, '--base': true, '--timeout': true },
  handoff: { '--name': true, '--prompt': true, '--unattended': false, '--model': true },
};

// Lowercase, kebab-case, a letter first, at most 32 characters.
export function normalizeName(raw) {
  const trim = (s) => s.replace(/^[-_]+/, '').replace(/[-_]+$/, '');
  let name = trim(raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-'));
  if (!/^[a-z]/.test(name)) name = `x${name}`;
  return trim(name.slice(0, 32));
}

export function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { command: 'help' };
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command)) throw new UsageError(`unknown command: ${command}`);

  const flags = FLAGS[command];
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (!(flag in flags)) throw new UsageError(`unknown option for ${command}: ${flag}`);
    if (!flags[flag]) {
      opts[flag] = true;
      continue;
    }
    if (i + 1 >= rest.length) throw new UsageError(`missing value for ${flag}`);
    opts[flag] = rest[++i];
  }

  if (command === 'detect') return { command };

  const required = (flag) => {
    if (opts[flag] === undefined || opts[flag] === '') throw new UsageError(`${command} needs ${flag}`);
    return opts[flag];
  };
  const name = normalizeName(required('--name'));

  if (command === 'handoff') {
    return { command, name, prompt: required('--prompt'), unattended: opts['--unattended'] === true, model: opts['--model'] ?? null };
  }

  const author = required('--author');
  if (!FAMILIES.includes(author)) throw new UsageError(`--author must be one of ${FAMILIES.join(', ')}: ${author}`);
  const effort = required('--effort');
  if (!EFFORTS.includes(effort)) throw new UsageError(`--effort must be one of ${EFFORTS.join(', ')}: ${effort}`);

  const promptFile = opts['--prompt-file'] ?? null;
  const codeReview = opts['--code-review'] === true;
  if (promptFile !== null && codeReview) throw new UsageError('give --prompt-file or --code-review, not both');
  if (promptFile === null && !codeReview) throw new UsageError('critique needs --prompt-file or --code-review');
  if (codeReview && opts['--base'] === undefined) throw new UsageError('--code-review needs --base');
  if (!codeReview && opts['--base'] !== undefined) throw new UsageError('--base goes with --code-review');

  let timeoutMinutes = DEFAULT_TIMEOUT_MINUTES[effort];
  if (opts['--timeout'] !== undefined) {
    if (!/^[1-9][0-9]*$/.test(opts['--timeout'])) throw new UsageError(`--timeout must be a whole number of minutes: ${opts['--timeout']}`);
    timeoutMinutes = Number(opts['--timeout']);
  }

  return { command, name, author, effort, promptFile, codeReview: codeReview ? { base: required('--base') } : null, timeoutMinutes };
}
