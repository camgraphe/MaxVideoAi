# Bounded live Studio conversation validation

Use `scripts/qa/studio-human-live.ts` only with explicit authorization for the
existing OpenAI credential and the cumulative text API budget. This runner has a
fixed **$5 ceiling per journal**, shared by Sol and Luna. A second journal would
create a second allowance: retain the same journal for the entire authorized run.
Never reset it to continue spending. This procedure authorizes no media generation,
customer wallet debit, production database access or publication.

## What is exercised

The runner calls the actual `createStudioConversationDirector`, its strict tool
schemas, instructions and four-response loop through the standard global OpenAI
Responses API. It uses the production input-token counter projection and supplier
usage interpretation. Customer messages can be supplied one adaptive round at a
time, retaining the same case ID and model. A separate synthetic customer actor
should see only the visible transcript and its own job/constraints.

The catalog is a **controlled projection** of branch model facts and Studio
certification. It does not establish live provider availability. Memory uses an
in-process fixture, not the durable database. Price reads deliberately return
**18 cents/image and 120 cents/video**: those are receipt-use fixtures, never
current MaxVideoAI commercial quotes. Preparation, generation, editing, cancellation
and export are blocked. A blocked preparation is an unexercised boundary, not a
successful end-to-end generation or a product-provider failure.

Validate real canonical prices, ownership, wallet settlement, interruptions and
idempotency separately with the normal service/database integration tests. Live
external MCP catalog reads and host verification are also separate evidence.

## Execution

Create a JSON request array with `{id, model, message}` entries. Models must be
`gpt-6.1-sol` or `gpt-6-luna`. Reuse an ID for the next customer turn; use a distinct
ID for a fresh experiment or another model. Keep all data synthetic.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/qa/studio-human-live.ts \
  --live \
  --journal /absolute/controlled-evidence/journal.json \
  --requests /absolute/controlled-evidence/next-turns.json \
  --authorized-key-file /absolute/previously-authorized/.env.local
```

Only `OPENAI_API_KEY` is extracted from the specified file. The runner does not
load the file into the environment or use its other credentials. Do not print,
copy, commit or include that key file in evidence. No SDK retries are enabled.

The runner acquires an exclusive journal lock. Before every generated response it
counts the exact token-bearing request, rejects context above 272,000 input tokens,
then persists a reservation covering the **entire** standard-context ceiling and
2,200 output tokens. It settles the conservative provider-cost upper bound from
returned usage. Unknown usage or an interrupted dispatch retains the reservation
and blocks further calls. An explicit rejected client request can release its
reservation; a timeout is not evidence of zero spend. A persisted hold after a
process crash requires trusted reconciliation before reuse.

## Evidence and interpretation

The journal retains synthetic visible messages, replies, tool requests/results,
usage, cost bounds, request hashes and source revision. It never persists raw
provider output or encrypted/private reasoning. Later runner versions also retain
content-addressed snapshots of explicitly whitelisted source files; these identify local
changes beyond HEAD. Older entries without those snapshots retain their weaker
provenance and must not be retroactively described as exact clean-commit runs.

Report failed and interrupted dialogues alongside successful ones. Distinguish
the customer-visible review from backend receipts: a blind actor cannot verify
that a save or charge happened merely because the reply says so. Check receipts
separately before classifying such an assurance as false or correct.

These small synthetic conversations test useful progress, intent preservation,
language continuity, price explanation and tool choice. They do not establish an
artistic ranking, a representative customer success rate, long-conversation cost,
production invoice, mobile end-to-end model performance or host certification.

Focused guard verification: `tests/studio-live-budget.test.ts`. The full service
financial simulations remain in `tests/studio-assistance-*.test.ts`.
