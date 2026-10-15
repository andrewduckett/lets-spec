// backlog.mjs next and claim. run() touches nothing real: it gets gh through
// deps.execFile, and writes through deps.stdout and deps.stderr.
import { GhError, makeGh } from './gh.mjs';
import { claimRefusal, formatStory, nextStory } from './rules.mjs';

export const USAGE = `backlog.mjs: pick and claim the project's next story on GitHub.

Usage:
  backlog.mjs next        print the next story, then its URL
  backlog.mjs claim <n>   assign issue <n> to you

Run it from the repo root as
node .agents/skills/lets-build/scripts/backlog.mjs.
`;

// A refusal: run() prints its message and exits 1.
class Refusal extends Error {}

function requireNumber(value) {
  if (!/^[0-9]+$/.test(value ?? '')) throw new Refusal(`expected an issue number, got '${value ?? ''}'.`);
}

async function next(gh, stdout) {
  const repo = (await gh.run(['api', 'repos/{owner}/{repo}', '--jq', '.full_name'])).trim();
  // Rank the stories on every page, not just the first 100.
  const pages = JSON.parse(await gh.run([
    'api', '--paginate', '--slurp', '-X', 'GET', 'search/issues', '-f', 'advanced_search=true', '-f', 'per_page=100',
    '-f', `q=repo:${repo} is:issue is:open no:assignee -is:blocked -label:kind/epic -type:Epic`,
  ]));
  const story = nextStory(pages.flatMap((page) => page.items ?? []));
  if (!story) throw new Refusal('no story is ready. Every open story is an epic, assigned, blocked, untriaged or Wont.');
  stdout(`${formatStory(story)}\n`);
}

async function claim(gh, number, stdout) {
  const issue = JSON.parse(await gh.run(['api', `repos/{owner}/{repo}/issues/${number}`]));
  const refusal = claimRefusal(issue);
  if (refusal) throw new Refusal(refusal);
  stdout(await gh.run(['issue', 'edit', number, '--add-assignee', '@me']));
}

export async function run(argv, { execFile, stdout, stderr }) {
  const [command = '', number] = argv;
  if (command === '' || command === '-h' || command === '--help') {
    stdout(USAGE);
    return command === '' ? 1 : 0;
  }
  const gh = makeGh(execFile);
  try {
    if (command === 'next') {
      await next(gh, stdout);
    } else if (command === 'claim') {
      requireNumber(number);
      await claim(gh, number, stdout);
    } else {
      throw new Refusal(`unknown command '${command}'. Use next or claim.`);
    }
    return 0;
  } catch (error) {
    if (error instanceof GhError) {
      if (error.stderr) stderr(error.stderr.endsWith('\n') ? error.stderr : `${error.stderr}\n`);
    } else if (!(error instanceof Refusal)) {
      throw error;
    }
    stderr(`backlog.mjs: ${error.message}\n`);
    return 1;
  }
}
