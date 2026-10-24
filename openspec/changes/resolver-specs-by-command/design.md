## Context

Since #111, the `lets delegate` commands ask the adapters in `Deps.resolvers`. `lets/src/main.ts` builds them on the kit's real io. The tests in `tests/lets/delegate/` call each command's `run(options, deps)` with `commandDeps()`. That fixture gives `t3` and `cli` fake adapters (`fakeAdapter`) and gives `subagent` its real adapter on the kit's fake io. Each adapter call is recorded.

The two `resolver.test.ts` files test the real `t3` and `cli` adapters through the program path instead: `buildRequest` from `kit/protocol.ts`, then `adapterAnswer` from `kit/resolver.ts`, through the `handle` fixture. Their assertions are on a program's exit code, stdout and stderr. The deletion story removes `protocol.ts`'s request parsing and `resolver.ts`, so these tests must stop using them first.

What the commands show, and so what a twin test can assert (D4):

| A program answered | The command shows |
|---|---|
| `probe` with `options` | `instructions`' JSON line, `options` |
| a warning on stderr | a `lets delegate: <message>` line on stderr |
| `run` with `text`, `family`, `model`, `handle` | stdout is the text; the JSON line on stderr has `family`, `model` (the `--model` value's model) and `handle` |
| exit 75 | the next resolver answers, or exit 2 with "every resolver declined" |
| exit 3, 5 or 6 | exit 3 with a `<model>: <reason>` line, exit 5, or exit 6 |
| `finish` with ok | `review run` finishes with ok on a clean tree and a final message, and without ok otherwise |

## Goals / Non-Goals

**Goals:**
- Every case in the two `resolver.test.ts` files has one twin that runs a delegate command with the real adapter, or, in three cases, an adapter-level test (D9, D10).
- No test under `tests/lets/resolvers/t3/` or `tests/lets/resolvers/cli/` imports `kit/protocol.ts`, `kit/resolver.ts`, `kit/verbs.ts` or the `handle` fixture.

**Non-Goals:**
- Changing `lets/src/`. If a twin fails, the spec or the test is wrong, not the adapter.
- New tests for scenarios that `t3.test.ts` or `cli.test.ts` already check (D11).
- Touching `kit/fixtures/handle.ts`, `kit/resolver.test.ts`, `kit/verbs.test.ts` or `subagent.test.ts`. They test the program path, which the deletion story removes.

## Test Seams

- **Primary test seam:** each delegate command's `run(options, deps)` (`review.ts`, `handoff.ts`, `instructions.ts`) with `commandDeps()`, as the tests in `tests/lets/delegate/` already use it.
- **Existing seams reused:** `commandDeps()` in `tests/lets/delegate/fixtures/command-deps.ts`; the kit's fake io in `tests/lets/resolvers/kit/fixtures/fake-io.ts`; the `t3-schema.sql` fixture; and, for the three cases with no command-level twin, the adapter returned by `createAdapter(io)`.

## Scrutiny Tier & Blast Radius

- **Tier:** low
- **Blast radius:** specs and tests only. Two spec files, one test fixture, two test files added and two deleted. No code under `lets/src/` changes.

## Decisions

### commandDeps takes a real adapter by name

`commandDeps` gets one new option, `real`: a partial map from resolver name to an `Adapter`. A name in `real` gets that adapter. It is still wrapped by `recorded`, so `adapterCalls` sees it. Otherwise the name gets a fake from `adapters`, or the default fake, as now. A test builds the real adapter itself, with `createAdapter(fakeIo({...}))`, and keeps the fake io to read `calls`, `files` and `removed`.

Alternatives: let `adapters` accept either a `FakeResolver` or an `Adapter`. This needs a type test on each value, and it mixes two meanings in one option. Or build a second fixture for real adapters. This would copy the git and config set-up that `commandDeps` already has. One option is the smallest change.

### The twins live beside each adapter's unit tests

The twins go in `tests/lets/resolvers/cli/delegate.test.ts` and `tests/lets/resolvers/t3/delegate.test.ts`, which take the place of the two `resolver.test.ts` files. A reader looking for what `cli` does finds every test for it in one folder. The name says the seam: the tests run `lets delegate`.

Alternative: `tests/lets/delegate/`. That folder tests the chain with fake adapters, and putting real adapters there would mix two kinds of test.

### The repository is /repo

`commandDeps` answers `git rev-parse` with `/repo`, so the commands pass `cwd` `/repo` to an adapter. The twins use `/repo` where the old cases used `/r`: the T3 project's `workspace_root`, and the `.workspace/lets-delegate/` paths. The T3 adapter runs its own `git` through its own io, so a T3 twin still queues the two git answers on that io.

### The cases with no command-level twin

The packet's rule is "a twin at the chain, or at the adapter itself". Three cases have no twin at the chain (D10):

- *finish removes nothing for a process handle whose id is not a session name* becomes a call to the cli adapter's `finish` with handle `process ../x`. The test asserts that it throws and removes nothing. The program used to catch this and exit 0. In process, `review run` reports a failed finish as a warning, but it only ever finishes a handle the adapter made, so a test could not reach this case through the command.
- *finish refuses a handle of another kind* (t3 and cli) becomes an assertion that `createAdapter(io).handleKind` is `thread` for `t3` and `process` for `cli`. `kit/resolver.test.ts` tests the refusal for any adapter. The rule stays in `resolvers` until the deletion story removes it with the programs.
- *a run with no model* stays a `resolvers` rule. At the command level, `review.test.ts` already checks that a bad or missing `--model` exits 2 and asks no resolver.

### Each moved scenario's test

Verify reads this table. "unit" means a test in `t3.test.ts` or `cli.test.ts` that stays.

| Requirement | Scenario | Test |
|---|---|---|
| One resolver runs every family CLI on PATH | One CLI on PATH | cli twin |
| | Inside T3 Code | cli twin |
| The cli resolver declines when no family CLI is on PATH | No family CLI | cli twin |
| | No family CLI, and the default next | cli twin |
| The cli resolver runs a review headless | A review with codex | cli twins |
| | A bare family | cli twin |
| | A gemini model at high effort | cli twin |
| | A review leaves the tree unchanged | unit: each CLI's read-only arguments |
| | The CLI fails | cli twins |
| | The CLI cannot start | cli twin |
| | The review runs too long | cli twin |
| The cli resolver declines every handoff | A handoff with CLIs on PATH | cli twin |
| | Handoff instructions with codex on PATH | cli twin |
| The cli resolver cleans up after a review | Finishing a review with codex | cli twin |
| | Finishing a review that changed the tree | cli twin |
| T3 Code has its own resolver | Inside T3 Code | t3 twin |
| | Inside T3 Code on a system with no /proc | t3 twin |
| The T3 resolver opens a session in a T3 thread | A review inside T3 Code | unit: run launches a plan-mode thread |
| | A handoff inside T3 Code | unit: a start runs the request's model |
| The T3 resolver declines outside T3 Code | Inside herdr | t3 twin |
| | While T3 Code runs elsewhere | t3 twin |
| The cli resolver lists the models each CLI reports | Every CLI on PATH | unit: the families are listed gpt, claude, gemini |
| The cli resolver lists the bare family when a listing fails | codex is signed out | cli twin |
| The T3 resolver lists the models in its manifest | Reading the manifest | unit: options list each provider |
| | No manifest | t3 twin |
| A resolver runs a model it never listed | A model the listing lacks | cli twin |
| A refusal exits 3 | The CLI refuses the model | cli twin |
| | A refusal after an earlier run with the same name | cli twin |
| | T3 has no project for the repository | t3 twin |
| | T3 fails the run before any message | t3 twin |
| | T3 does not reply | unit: no reply from t3 is an unknown outcome |
| The T3 resolver archives a refused thread | A refused model | t3 twin |
| The T3 resolver keeps its token beside the lets config | all four | unit: the four XDG_CONFIG_HOME token tests |

## Risks / Trade-offs

- [A twin asserts less than the case it replaces, such as a decline's stderr text] → The spec already drops what the command does not show (D5). Each twin keeps every other assertion of its case, and the task that deletes a `resolver.test.ts` file checks the cases one by one.
- [A restated scenario says more than the adapter does] → The twins run the real adapters. A twin that fails shows a spec that is wrong, and the spec is fixed, not the code.
- [Archive drops or alters a requirement in the move] → A rehearsed archive in `.workspace/` is compared requirement by requirement with the delta, as the `resolvers-capability` change did.

## Migration & Rollback

N/A. No code, config or data changes shape. Reverting the branch's commits restores the old spec and tests.
