## Story

#40 delegate-config-and-sync — one command detects what the machine offers, installs the resolver that fits, and writes the user's delegate config.
https://github.com/andrewduckett/lets-spec/issues/40

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Can setup learn which models an account can run? | Yes for gpt (`codex debug models`) and gemini (`agy models`); claude has no list, so its entry uses the CLI's default. T3's `model-manifest.json` lists what T3 knows, not what the account runs. | Evidence: `codex debug models`, `agy models` on this machine; `contrib/lets-delegate-resolver/src/t3.ts` |
| D2 | What does the command do? | `lets delegate setup` detects the harness, the family CLIs and each account's models, shows them, and proposes a config. | User |
| D3 | Who drives the guided part? | The CLI proposes and writes nothing; `--write` writes the config, and flags change a choice. People and agents drive it the same way. | User |
| D4 | How does a review choose its family and model? | An ordered reviewer list in the config. Each entry has a family, a model (or `null` for the tool's default) and optional efforts. A review takes the first entry that serves its effort and is not the author's family. If none is, it takes the first entry that serves the effort, and reports `independent: false`. | User |
| D5 | What does setup propose? | One entry for each family the account can run, in today's order (gpt, claude, gemini), with the first model the account lists and no effort limits. | User |
| D6 | How does gemini's effort fit? | An entry names the gemini base model; the resolver adds the effort, as T3 lists `gemini-<version>-<effort>`. | Evidence: `agy models`; `familiesFromT3Manifest` in `t3.ts` |
| D7 | Who walks the reviewer list? | `lets delegate review` reads the config and sends the entries that serve this effort in the `run` request, as a new optional protocol 1 field. The resolver takes the first entry its harness can run. Without the field, it uses its own rule. Only `lets` reads the config file. | User |
| D8 | Split the story? | Yes. This story keeps detect, show, propose, write, read and use. Installing or updating the resolver from the release moves to #44. | User |
| D9 | Which resolver does the config name? | The one setup finds: `lets-delegate-resolver` on `PATH` when T3 or herdr is present, else none, so the built-in default answers. | User |
| D10 | Lookup order in `lets delegate`? | `LETS_SPEC_RESOLVER`, then the config's resolver, then `PATH`, then the built-in default. | Evidence: issue #40 Scope |
| D11 | The config names a resolver that is missing or cannot run? | `lets delegate` exits 2, names the path, and says to run `lets delegate setup` again. | User |
| D12 | No entry in the list can run? | The resolver exits 3 and names each entry it skipped and why. The review skills already run the review in a subagent on exit 3. | User |
| D13 | Where does the config live? | `~/.config/lets-delegate/config.json`, beside the T3 token, honouring `XDG_CONFIG_HOME`. | User |
| D14 | What does setup cost? | It starts no session and spends no tokens: it only runs list commands and reads files. | User |
| D15 | Output and re-runs? | Readable text by default, `--json` for agents. Running it again shows the current config next to the proposal, and `--write` replaces the file. | User |
| D16 | Does a handoff use the list? | No. `start` keeps its own model choice; the handoff design is out of scope. | Evidence: issue #40 Scope |
| D17 | How does this relate to #34? | With a config, the list avoids a model the account cannot run. #34 still fixes the T3 adapter's choice when no list is sent. | Evidence: issue #34 Scope |

## Changes from the story

- Split out: installing or updating the resolver from the release `lets` runs from, and recording the installed copy, moved to #44, blocked by this story. Reason: with it, the story was about 14 tasks. This story records the resolver it finds on `PATH`.
- Added: the `run` request gains an optional reviewer list, and the contrib resolver (T3 and herdr) walks it. Reason: a config that names models changes nothing unless the session uses them.
- Added: `--write` and flags to change a choice. Reason: the guided path is "propose, then confirm", and agents must be able to drive it.

Confirmed by user: yes
