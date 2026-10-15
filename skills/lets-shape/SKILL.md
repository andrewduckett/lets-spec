---
name: lets-shape
description: Break a large product requirements document (PRD), vision, issue, or product idea into a release plan for an OpenSpec project — personas, journey map, MoSCoW priorities, and thin vertical stories filed as GitHub issues that lets-build picks up one story at a time. Use when a feature or PRD is too big for one OpenSpec change, when the user asks to split or prioritize work, when a new request must be fitted into an existing backlog, or to resume or revise a discovery.
---

# Let's shape

Shape a large idea into a backlog. This is discovery: personas, a journey map, MoSCoW priorities (Must, Should, Could, Won't) and thin vertical stories. Run every command below from the repo root.

**Discovery plans; it does not build.** Read files, search code and investigate the codebase. Never write application code, and never create a change. Discovery writes two things, and nothing else: no roadmap, release plan or changelog.

- `openspec/discovery.md` — the living map: personas and journey map ([templates/discovery-template.md](templates/discovery-template.md)). It outlives every run; see [The Map](#the-map).
- GitHub issues — one **parent issue** per discovery run, and the stories ([templates/issue-template.md](templates/issue-template.md)).

Changes are created later, one at a time, by `lets-build`.

**The input is read-only.** A discovery run starts from an input: a PRD or vision file, a GitHub issue, pasted text, or just conversation. Read it. Never create, edit or restate it in a file. The run records what it decides in its parent issue: the confirmed scope, the priorities and the Won't calls.

**This is a stance with a light structure.** The phases below give the conversation a shape. They are not a script. Revisit an earlier phase when new information arrives, and confirm with the user before you move to the next.

Set an issue's kind and priority only with `node .agents/skills/lets-shape/scripts/backlog.mjs set-kind <n> <Epic|Story>` and `node .agents/skills/lets-shape/scripts/backlog.mjs set-priority <n> <Must|Should|Could|Wont>`. The script knows whether this repo records them as labels or as issue fields.

## The stance

- **Curious, not prescriptive.** Ask the questions the input raises.
- **Visual.** Draw journey flows and priority tables.
- **Grounded.** Explore the codebase, and annotate the plan with what exists today.
- **Adaptive.** Follow a thread, and change course when new information arrives.
- **Outcome-oriented.** Converge on concrete output: the map and the issues.
- **One phase at a time.** Confirm each phase before the next.
- **Checkpointed.** Write every confirmed phase at once, so the session can stop and resume at any phase boundary.

## The map

`discovery.md` describes the people the product serves and the paths they take through it. It is not a record of runs. Many runs edit the same map, so its size follows the number of personas and paths, never the number of runs. Every run keeps these rules:

- **Personas are durable.** A persona entry reads the same before and after any single epic ships. *Pain today* is the person's real-world problem without a good tool; *Success looks like* is the lasting outcome they want. Neither names code, milestones, or epics. Edit a persona only when facts about the person change.
- **Personas sit in audience groups.** Under `## Personas`, one `###` heading per audience — typically `People who use <product>` and `People who build <product>` — and one `####` entry per persona. Omit a group that has no personas. `## Journey Map` uses the same groups.
- **One journey per distinct path.** Personas who walk the same stages share one journey, named for all of them, with an *Implication* note saying what that means for the build. A stage only some of them reach stays in the shared journey and names whose it is, such as `Bump pins (Mo)`. A persona gets its own journey only when most of its stages differ.
- **A journey shows the full path.** Map every stage the persona goes through, not only the part this run's input covers. Draw future stages only from sources the project already has (vision, architecture docs, decision records); do not invent them.
- **Annotations show present status only.** A `supported` stage links no issues — the code is the evidence. A `partial` or `gap` stage links only the open issues that close it. A `gap` with no link is known but unplanned.
- **A freshness line dates the annotations.** The Journey Map opens with `Stage status checked against the code on YYYY-MM-DD.` Update it whenever you re-check stages.
- **Epic scope stays out.** A run's scope, exit criterion, and "what this release covers" go in its parent issue, never in the map. No section, heading, or persona is named for a milestone or epic.
- **Finished journeys stay.** A journey whose stages are all `supported` stays in the map; it still shows what the product does. Only a path that no longer applies is removed.
- **Removal is recorded.** Remove a persona or journey that no longer applies, and note the removal and its reason in the current run's parent issue.

## Locate the discovery

At the start:

1. Run `openspec list --json` and take the OpenSpec root from `root.path`. It must be this repository's root, or a directory inside it: `openspec list` answers with the nearest root, which can be a parent of the repository. If it is outside, stop and say the project has no OpenSpec root. Use the resolved root everywhere below, never a bare `./openspec/`.
2. Read `<root.path>/openspec/config.yaml` (or `config.yml`) if it exists. Its `context` and `rules` are constraints for you to follow, not content to reproduce.
3. Run `gh repo view --json nameWithOwner,url`. The map's links need the owner and the name.
4. Pick the mode, first match wins:
   - **An open parent issue says `Discovery status: in-progress`** (`gh issue list --state open --search '"Discovery status: in-progress" in:body' --json number,title,body`): [Resume mode](#resume-mode). If more than one does, list them and ask the user which to resume, or whether to start a new run. Never pick one yourself.
   - **`<root.path>/openspec/discovery.md` does not exist**: run every phase.
   - **Otherwise**: [Revision mode](#revision-mode).

If any of these fails, stop and show the error. Never write the map anywhere but the resolved root.

## The phases

**Checkpoint every phase.** When the user confirms a phase, write its result at once, and set the parent issue's status line to the next phase: `personas`, `journey-map`, `moscow`, then `stories`. A revision run that skips personas and the journey map goes from Ingest straight to `moscow`.

Personas and the journey map go in `discovery.md`. Everything else goes in the parent issue.

The parent issue and `discovery.md` are the resume point. A future session with none of this conversation must be able to pick up exactly where this one stopped.

### Phase 1: Ingest

Take in the input — a file path, an issue (`gh issue view <n>`), pasted text, or just conversation. Then:

- Restate the scope in your own words; have the user confirm
- Surface goals and non-goals
- List open questions as they emerge (they land in the parent issue)

**Checkpoint:** The parent issue is public, so confirm its text first. Write it from the parent template in [templates/issue-template.md](templates/issue-template.md): the status line, the input reference, the confirmed scope and any open questions so far. Title it `Epic: <capability>`, create it with `gh issue create`, then run `node .agents/skills/lets-shape/scripts/backlog.mjs set-kind <n> Epic`. Phase 5 may turn it into a single story.

### Phase 2: Personas

Start from the personas already in `discovery.md`. For the people this input serves, reuse an existing persona first; extend its entry only if the input reveals a lasting fact about them. Add a new persona only for a person the map lacks; most runs add none. For each new persona:

- **Who** they are
- **Goal** they are trying to reach
- **Pain today** their real-world problem without a good tool
- **Success looks like** the lasting, observable signal they got value

Push back if personas are roles without needs ("admin") rather than people with goals, or if an entry would stop being true once this run ships (see [The Map](#the-map)).

**Checkpoint:** write the Personas section of `discovery.md` (create the file from [templates/discovery-template.md](templates/discovery-template.md) if it is missing).

### Phase 3: Journey map

For each persona this run serves, find the journey they walk. Extend an existing journey — add stages, re-annotate, link new stories — before drawing a new one; draw a new journey only for a path the map lacks. Map the persona's full path, not only this run's slice. Draw it:

```
  Discover ──► Sign up ──► First run ──► Daily use ──► Share
     │            │            │             │           │
    gap          gap        partial      supported      gap
```

Annotate every stage against the **real codebase** — read the code, do not guess:

- `supported`: works today
- `partial`: exists but incomplete for this journey
- `gap`: does not exist

Cite the open issue that closes a gap as a full link, `[#N](https://github.com/<owner>/<repo>/issues/N)`; a bare `#N` does not link inside a repository file. A `supported` stage carries no link.

**Checkpoint:** write the Journey Map section of `discovery.md`, with today's date on its freshness line.

### Phase 4: MoSCoW

Bucket the capabilities the journey surfaced into **Must / Should / Could / Won't (this release)**.

- Every Must needs a reason tied to a persona's journey
- Push back on Must inflation: if everything is a Must, nothing is
- Won't is a decision, not a dumping ground — record why

**Checkpoint:** write the MoSCoW section of the parent issue.

### Phase 5: Stories

Cut the Must (then Should) work into stories:

- **Every story is a thin vertical slice:** end-to-end and demoable, never a horizontal layer. A persona can do something new when it ships.
- **Each story is one OpenSpec change.** Its future proposal's what and why fits in about 200 words. If the story packet already strains that budget, the story is too big: split it.
- **The first story is the walking skeleton:** the thinnest path through the whole journey.
- **Order by dependency first, then value.**
- **Read the backlog before you cut:** `gh issue list --state all --limit 500 --json number,title,state,body,assignees`. Work that fits an open, unassigned story updates that issue instead of duplicating it.

Each story gets a **story packet**: the story template in [templates/issue-template.md](templates/issue-template.md). Every field is required, because the `lets-build` run that plans the story starts with none of this conversation.

**Size check-out:** after drafting the stories, review each against the ~200-word proposal budget. List every story that looks too large, each with 1-2 candidate split lines (or a one-line reason it genuinely resists splitting), and resolve with the user before finalizing.

**One story or many:**

- **The whole run fits one story.** The parent issue becomes that story. Retitle it `<kebab-story-name> — <one-line outcome>`, run `node .agents/skills/lets-shape/scripts/backlog.mjs set-kind <n> Story`, set its priority as below, and replace its body with the story template. Keep the status line and the input reference. Won't calls go in its Scope `out`.
- **More than one story.** The stories are sub-issues of the parent.

**Checkpoint:** Issues are public, so show the new and changed issues as a table (title, blocked by, MoSCoW) and confirm. Put each blocker on the story it blocks, never only on the parent, because `lets-build` cannot see a blocker on a parent issue when it picks the next story. When something blocks every story under the parent, give each story its own `--blocked-by` link. Then create them in dependency order, blockers first:

```bash
gh issue create --title "<title>" --body-file <file> --parent <parent#> [--blocked-by <n>,<n>]
```

For each issue:

1. The command prints the issue URL. The number is its last segment.
2. Run `node .agents/skills/lets-shape/scripts/backlog.mjs set-kind <n> Story`.
3. Run `node .agents/skills/lets-shape/scripts/backlog.mjs set-priority <n> <Must|Should|Could>` with the story's MoSCoW value.
4. Stop at the first error, including a failed kind or priority update.
5. Before you retry, search for the title with `gh issue list --state all --search "<title> in:title"`, so you never create a duplicate. If the issue exists but its kind or priority is unset, set it on that issue. Do not create the issue again.

### Phase 6: Finalize

Remove the status line from the parent issue. Keep the `Input:` line, so the run always names what it started from. Resolve every open question, or move it to the story it blocks. Link the journey stages in `discovery.md` to the stories that close them. `## Backlog` stays a single link to the repository's issues page, never a list of issues. Show the user the stories as a checklist of issue links.

Then hand off:

> The stories are GitHub issues under #<parent>. To start building, run `lets-build` on the default branch: it picks the next story, claims it and plans it. Run this skill again at any time to revise the plan.

## Resume mode

When an open parent issue says `Discovery status: in-progress` (or the user picked one of several):

1. **Read it and `discovery.md`.** The status line records the next phase; the sections already present are confirmed work.
2. **Restate where discovery stopped** — a one-paragraph summary of what the parent issue and map already capture — and confirm with the user.
3. **Continue from the recorded phase.** Do not re-litigate confirmed sections unless the user brings new information; then revisit and update them.

## Revision mode

When `discovery.md` exists and no run is in progress:

1. **Read it**, then reconcile the map against reality:
   - `gh issue list --state all --limit 500 --json number,title,state,stateReason,parent` lists shipped and open stories
   - Run `node .agents/skills/lets-shape/scripts/stale-links.mjs <root.path>/openspec/discovery.md`. It prints each link to a closed issue. Re-check each one's stage against the code, then do one of:
     - the stage now works: upgrade it and drop the link;
     - an open issue now closes the gap: link that one instead;
     - nothing open does: drop the link and leave the stage an unplanned `gap`.
   - Re-annotate every journey stage against the code; stages move to `supported` as their stories ship
   - Update the freshness line to today
2. **Take in what the user brings** — a new PRD, new requirements, changed priorities, learnings from shipped stories. New work is a new run with its own parent issue: Ingest, then MoSCoW and Stories. Revisit Personas and the Journey Map only when the input changes who the product serves or how they use it.
3. **Priorities of existing stories are revisable too:** update the story's MoSCoW line, with its reason, and run `node .agents/skills/lets-shape/scripts/backlog.mjs set-priority` in the same step.
4. **Never silently delete a story.** Close a superseded story as not planned with a one-line reason, so the plan's history stays legible: `gh issue close <n> --reason "not planned" --comment "Superseded by #<m>: <reason>"`.

## Handing off to lets-build

- Discovery **never** creates changes. `lets-build` creates them, one story at a time.
- `lets-build` picks the next story, and owns the selection rule. The user can also name an issue for it.
- The story packet is the input — it must stand alone.
- One story per change. If the user asks you to batch-create proposals for all stories, decline and explain: proposals written ahead of implementation go stale and overlap on shared specs.
