# Evals

These development-only scenarios test what the user sees: skill routing, live
catalog use, quote approval, job recovery, and concise delivery. They do not
test internal logging or exact prose.

`scenarios.md` contains the compact release smoke set. `conversation-cases.json`
contains the broader multilingual corpus: natural and intentionally imperfect
requests across planning, prompting, account, generation, and recovery. The
corpus is safe for no-spend evaluation because every case prohibits
`confirm_generation`.

Run every scenario in a fresh agent session with the same plugin version. For
each round, record the commit, date, plugin version, pass/partial/fail result,
failure mode, and time-to-result. Compare rounds before changing a default or a
routing boundary.

Validate the corpus structure with:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-conversation-evals.test.ts
```

Add a scenario when a user reports unexpected behavior, a bug reaches manual
testing, or a new workflow changes an observable decision. A stable decision
should be promoted into the skill only after repeated results support it.
