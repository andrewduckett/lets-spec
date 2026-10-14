// stale-links.mjs: list the issue links in a discovery map that point at
// closed issues. run() touches nothing real: it reads through deps.readFile,
// gets gh through deps.execFile, and writes through deps.stdout and
// deps.stderr.
import { GhError, makeGh } from './gh.mjs';

export const USAGE = 'usage: stale-links.mjs <path/to/discovery.md>\n';

const LINK = /https:\/\/github\.com\/([^/]*\/[^/]*)\/issues\/([0-9]+)/g;

// Every issue link in the text, in order: { line, repo, number }, with line
// counted from 1.
export function findLinks(text) {
  return text.split('\n').flatMap((content, index) =>
    [...content.matchAll(LINK)].map(([, repo, number]) => ({ line: index + 1, repo, number })));
}

// Prints "<line>: #<n> <title>" for each link to a closed issue, in file
// order. Each issue is looked up once. Prints nothing for a clean map.
export async function run(argv, { readFile, execFile, stdout, stderr }) {
  const [map] = argv;
  if (map === '-h' || map === '--help') {
    stdout(USAGE);
    return 0;
  }
  if (!map) {
    stderr(USAGE);
    return 1;
  }

  let text;
  try {
    text = readFile(map);
  } catch (error) {
    stderr(`stale-links.mjs: cannot read ${map}: ${error.message}\n`);
    return 1;
  }

  const gh = makeGh(execFile);
  const issues = new Map();
  try {
    for (const { line, repo, number } of findLinks(text)) {
      const key = `${repo}#${number}`;
      if (!issues.has(key)) {
        issues.set(key, JSON.parse(await gh.run(['issue', 'view', number, '-R', repo, '--json', 'state,title'])));
      }
      const { state, title } = issues.get(key);
      if (state === 'CLOSED') stdout(`${line}: #${number} ${title}\n`);
    }
    return 0;
  } catch (error) {
    if (!(error instanceof GhError)) throw error;
    if (error.stderr) stderr(error.stderr.endsWith('\n') ? error.stderr : `${error.stderr}\n`);
    stderr(`stale-links.mjs: ${error.message}\n`);
    return 1;
  }
}
