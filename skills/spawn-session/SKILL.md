---
name: spawn-session
description: Use when a lets-spec skill must start a fresh agent session from inside a running one, either to get an independent critique back or to hand the apply step to a new context. The session lands in the harness the parent runs in.
---

# spawn-session

This skill's script starts a fresh agent session from inside a running one. A
review skill uses it to get a critique back from another model family, and
`lets-build` uses it to hand the apply step to a new context.
