# Bounded live Studio conversation validation

Use `scripts/qa/studio-human-live.ts` only with explicit authorization for the
existing OpenAI credential and the cumulative text API budget. This runner defaults to a
**$5 ceiling per journal**, shared by Sol and Luna. `--authorized-cap-usd` can raise
that cumulative ceiling only after explicit human authorization; it preserves earlier
settled spend and unresolved holds. The 2026-10-04 campaign is authorized for **$15
including all previous validation spend**, not an additional $15. A second journal would
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

Without `--prepare-in-isolated-db`, the catalog is a **controlled projection** of branch model facts and Studio
certification. It does not establish live provider availability. Memory uses an
in-process fixture, not the durable database. Price reads deliberately return
**18 cents/image and 120 cents/video**: those are receipt-use fixtures, never
current MaxVideoAI commercial quotes. Preparation, generation, editing, cancellation
and export are blocked. A blocked preparation is an unexercised boundary, not a
successful end-to-end generation or a product-provider failure.

Validate real canonical prices, ownership, wallet settlement, interruptions and
idempotency separately with the normal service/database integration tests. Live
external MCP catalog reads and host verification are also separate evidence.

### Actual preparation in disposable PostgreSQL

`--prepare-in-isolated-db` uses the actual conversation service, checkpoints,
project memory, owned-asset resolver, canonical validation and quote persistence.
It refuses any preconfigured `DATABASE_URL`, allocates local disposable PostgreSQL
and destroys it on completion. Every dialogue has a separate synthetic account,
wallet funding fixture and owned media identities; production account rate limits
remain active. Repeated turns share the same project and account.

Image/video quotes are also prepared through the OAuth MCP core for the same
account and canonical request. Request JSON, amount and currency must agree;
session/project versus OAuth/client scope intentionally differs. Quote IDs are
transport-specific. This proves backend parity, not external MCP host tool
selection. Public MCP audio remains gated, so audio preparation has no false
public MCP parity assertion.

Pricing uses the actual engine and branch supplier facts with the integration
fixture's commercial policy and membership tables. These amounts are **not current
production tariffs** and must not appear in customer pricing evidence. Provider
availability is controlled. Seven existing public repository fixtures have
measured file sizes, MIME types, durations and applicable dimensions: four images,
one six-second product video, a 28-second ambient recording and a 15.216-second
voice sample. The runner checks their bytes and measures metadata before allocating
PostgreSQL. Stored CDN URLs are local fixture aliases; Responses receives the
four images as exact data URLs. Video and audio attachments are typed identities
and measured metadata, without video/audio bytes or a claim of content analysis.
Each turn records its selected fixtures' metadata and SHA-256 hashes. No private
customer media or production database is read.

Paid submission functions throw, and the runtime asserts zero generation jobs,
zero charge receipts and no submitted quote. Editing/export are disabled here.
Assistance billing is intentionally disabled. Starting with the October 5 workflow
cohort, the Response wrapper preserves the director's production medium reasoning
effort for both Sol and Luna and records the requested effort. Earlier cohorts
used Sol/medium and Luna/low; they are not evidence for medium-effort Luna.
Qualify production assistance allowances, refunds, model
selection and ambiguous outcomes separately with financial service integrations.

The disposable database is not reconstructed from the journal after a restart.
Previously recorded case IDs are rejected before a new Response dispatch; use
fresh IDs for a new experiment. Adaptive follow-ups remain in one running process.
A journal transcript alone is not proof of restored continuity.

## Execution

Create a JSON request array with `{id, model, message}` entries. In isolated
preparation mode, optional `referenceKeys` selects `watch`, `watch_end`, `portrait`,
`abstract`, `watch_video`, `ambient_audio` or `voice_sample`. Models must be
`gpt-6.1-sol` or `gpt-6-luna`. Reuse an ID for the next customer turn; use a distinct
ID for a fresh experiment or another model. Keep all data synthetic.

`scripts/qa/fixtures/studio-human-personas.json` retains the 50 blind-authored
customer briefs from the October campaign. It is a seed corpus, not fixed
assistant prompts or expected answers. Project each brief into one fresh case per
assistant model, keeping its `message` and mapping `references` to `referenceKeys`.
Prefix case IDs with a unique cohort identity. The blind customer actor then writes
follow-ups from the actual visible exchange and quote card; it must not read the
backend journal, schemas or grader. Keep unsupported requests in the denominator.

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

Add `--prepare-in-isolated-db --adaptive` for actual quote preparation and adaptive
dialogue. The append-only request array is reread after queued work completes;
append the blind actor's next messages with the same IDs and model. Publish each
complete array through a temporary file and atomic rename; never truncate or
rewrite the watched file in place. Earlier observed entries cannot be changed
or removed. The runner observes `.done` before rereading the final queue, and
closes only after consuming that final snapshot. Create
`<requests-path>.done` when all intended rounds are queued; the process closes
after draining them. Use `--authorized-cap-usd 15` only for the explicitly approved
cumulative campaign. Retain one journal throughout all cohorts.

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
and emitted tool arguments (including proposals rejected by the product parser),
attempted visible reply text, usage, cost bounds, request hashes and source
revision. It never persists full provider responses or encrypted/private
reasoning. Later runner versions also retain
content-addressed snapshots of explicitly whitelisted source files; these identify local
changes beyond HEAD. Older entries without those snapshots retain their weaker
provenance and must not be retroactively described as exact clean-commit runs.
Newer runs also snapshot the exact emitted tool schemas under `toolSchemaHash`,
so a subsequent metadata fix cannot be confused with the schemas used by an
already-running process.

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
`tests/studio-call-runtime-postgres.test.ts` verifies persisted preparation,
Studio/MCP price parity, owned references, independent client limits, replay without
another Response or debit, and rejection of false restarted continuity.

Keep blind customer actors separate from deterministic receipt grading. Mix
ordinary requests, incomplete briefs, budget changes, explicit unavailable models,
image roles, multiple references and multi-part requests; stop at quote review,
not media purchase. Preserve pilot failures and corrected repeats in separate
cohorts. Record cases, customer turns, provider calls, quote coverage, actual
errors, unresolved work and cumulative cost; an estimate-only reply or an honest
unsupported request is not a completed quote. Synthetic results do not measure
customer satisfaction or artistic output quality.

## Selection validation and recovery

`conversation-preparation-validation.ts` marks only explicit input-validation
rejections before a creation draft, source promotion or quote mutation. The
server receipt carries `nextAction: {type: "studio_preparation_input", version: 1}`.
The director feeds that receipt back to the model using the Responses remaining
in the existing four-call limit. A fourth rejected selection yields an honest
continuation without a creation draft or quote. Successfully prepared quotes
still end the turn and require the client's confirmation.

Image selection is normalized before persisting its draft. Media preflight checks
canonical parameters and owned sources; only after validation and draft storage
may it promote ready project images and prepare the quote. Wallet, lease,
catalogue-read, ownership, provider, storage and ambiguous failures cannot gain a
correction marker merely because they share a public error code. Exports and
untyped Audio errors remain outside this correction path. Replaying a saved
Response or action receipt never purchases it again; a new corrective Response
uses the normal metered assistance budget.

`conversation-tool-reference-schema.ts` binds asset selections to the exact
reviewed attached image IDs in the emitted tool schemas. Server ownership and
capability validation remain mandatory. Labels and damaged IDs are never resolved
as aliases. Ready project output selections retain their separate identities.
Tests `studio-preparation-correction-postgres.test.ts` and
`studio-preparation-validation.test.ts` cover durable correction, paid-response
replay, final-response limits and the mutation/error boundaries.

## Visible reply projection and capability discovery

`conversation-reply.ts` projects an explanation containing explicit model protocol
delimiters to a neutral unavailable-explanation message. It applies to new drafts,
legacy reads and assistant history; user messages, creative prompts, scripts,
canonical requests and raw paid response/action checkpoints remain exact. Ordinary
prose and creative HTML are not stripped. A valid checkpoint with unusable visible
text remains replayable, so an interruption cannot purchase the same Response again.
`studio-reply-projection*.test.ts` exercise the actual directors, draft persistence,
old readers, history and paid PostgreSQL replay. This addresses malformed visible
text, not evidence of a leaked private reasoning field.

Compact Studio discovery reports `customImageSize` for images from the authorized
catalog's canonical resolution and width/height settings. Exact geometry constraints
still come from `model_details` and the shared validator; discovery does not certify
arbitrary dimensions. Numeric bounds are ranges, and suggested durations are examples.
Do not silently substitute a size or duration when the client requires an exact one.

## Recorded quote context

`conversation-run-repository.ts` reads the persisted customer amount, currency,
expiration and a bounded configuration through `conversation-quote-facts.ts`. The
existing thirty generation summaries remain; only the eight most recent include
these quote facts. The query enforces the current user, project and Studio session
origin. It selects an explicit settings whitelist and reference counts/roles,
without creative prompts, narration, reference IDs/URLs, provider costs or private
pricing snapshots. Omitted settings are unknown, not a claim that a feature is absent.

A new assistant Response receives these facts even when the previous successful
preparation stopped before its result entered model history. `amountCents` remains
recorded cents, never whole dollars or a fresh estimate. `expiredUnconfirmedQuote`
marks prepared TTL expiry or a persisted expired state; accepted/claimed amounts
remain their historical recorded prices. The projection cannot confirm or purchase
a quote, including when the flag is false. It never reprices or mutates one.
`studio-conversation-quote-facts-postgres.test.ts` verifies the real service context,
expiry semantics, ownership isolation, the bounded whitelist and replay without
a second Response, job or charge.

## Assistance-policy integration

The credit-policy branch is integrated without activating it in production.
Production approval v1 continues its existing one-time allowances and wallet
authorization; v2 explicitly selects monthly credits and prepaid packs after its
migration and activation review. Unknown policies stay disabled. The director's
interface guidance must follow that effective policy. Recorded calls settle at
their original tariff, and a v1 service must work with migrations 54/62 before
credit tables exist. Switching policies cannot silently convert a wallet limit
into prepaid credits or enable a different paid tariff.

Live dialogue preparation still uses disabled assistance billing in a disposable
fixture. It qualifies creation and quote behavior; it does not establish a live
credit-policy rollout or a production pack purchase.
