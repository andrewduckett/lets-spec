// backlog.mjs set-priority and set-kind. run() touches nothing real: it gets
// gh through deps.execFile, and writes through deps.stdout and deps.stderr.
//
// A repo records kind and priority with labels (kind/epic, priority/must)
// or with issue fields (the Epic type, the Priority field). A write uses
// the one deps.mode names, labels or fields, and clears the other on that
// issue. build/build-release.mjs writes the mode into the entry from the
// project's backlog choice in its flake.
import { GhError, makeGh } from './gh.mjs';
import { writeDecision } from './rules.mjs';

export const USAGE = `backlog.mjs: set the kind and priority of the project's issues on GitHub.

Usage:
  backlog.mjs set-priority <n> <Must|Should|Could|Wont>
  backlog.mjs set-kind <n> <Epic|Story>

Run it from the project root as
node .agents/skills/lets-shape/scripts/backlog.mjs. It needs gh.
`;

// A refusal: run() prints its message and exits 1.
class Refusal extends Error {}

function requireNumber(value) {
  if (!/^[0-9]+$/.test(value ?? '')) throw new Refusal(`expected an issue number, got '${value ?? ''}'.`);
}

function requireMode(mode) {
  if (mode !== 'labels' && mode !== 'fields') {
    throw new Refusal('this copy has no backlog mode. Run the copy lets-sync links into .agents/skills/lets-shape/.');
  }
}

// The id of the owner's Priority issue field. A priority write in fields
// mode needs it.
async function priorityField(gh) {
  const owner = (await gh.run(['api', 'repos/{owner}/{repo}', '--jq', '.owner.login'])).trim();
  const fields = await gh.unlessMissing(['api', `orgs/${owner}/issue-fields`]);
  const list = fields === null ? [] : JSON.parse(fields);
  const field = Array.isArray(list) ? list.find((each) => each?.name === 'Priority') : undefined;
  if (field?.id == null) {
    throw new Refusal(`${owner} has no Priority issue field. Use the github-labels backlog in the flake, or add the field.`);
  }
  return field.id;
}

// Create a label unless the repo already has it. A new repo has none of the
// backlog labels yet. The lookup is its own step, so its failure stops the
// command, and is never read as a missing label.
async function ensureLabel(gh, { name, description }, stdout) {
  const found = await gh.unlessMissing(['api', `repos/{owner}/{repo}/labels/${name.replaceAll('/', '%2F')}`]);
  if (found === null) stdout(await gh.run(['label', 'create', name, '--description', description, '--color', 'ededed']));
}

// Plan one write from the issue, then run its gh calls in order. The first
// failure stops the write.
async function write(gh, { op, number, value, mode }, stdout) {
  requireMode(mode);
  const field = mode === 'fields' && op === 'set-priority' ? await priorityField(gh) : null;
  const issue = JSON.parse(await gh.run(['api', `repos/{owner}/{repo}/issues/${number}`]));
  const decision = writeDecision({ issue, op, value, mode });
  if (decision.error) throw new Refusal(decision.error);

  for (const label of decision.ensureLabels) await ensureLabel(gh, label, stdout);
  if (decision.setPriorityField !== null) {
    stdout(await gh.run([
      'api', '--method', 'POST', `repos/{owner}/{repo}/issues/${number}/issue-field-values`,
      '-F', `issue_field_values[][field_id]=${field}`,
      '-f', `issue_field_values[][value]=${decision.setPriorityField}`,
    ]));
  }
  if (decision.setType !== null) stdout(await gh.run(['issue', 'edit', number, '--type', decision.setType]));
  if (decision.addLabels.length || decision.removeLabels.length) {
    const args = ['issue', 'edit', number];
    for (const name of decision.addLabels) args.push('--add-label', name);
    if (decision.removeLabels.length) args.push('--remove-label', decision.removeLabels.join(','));
    stdout(await gh.run(args));
  }
}

export async function run(argv, { mode, execFile, stdout, stderr }) {
  const [command = '', number, value = ''] = argv;
  if (command === '' || command === '-h' || command === '--help') {
    stdout(USAGE);
    return command === '' ? 1 : 0;
  }
  const gh = makeGh(execFile);
  try {
    if (command !== 'set-priority' && command !== 'set-kind') {
      throw new Refusal(`unknown command '${command}'. Use set-priority or set-kind.`);
    }
    requireNumber(number);
    await write(gh, { op: command, number, value, mode }, stdout);
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
