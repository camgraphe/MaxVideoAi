# Shared assistant review

The **Assistant review** admin entry (`/admin/assistants`) opens retained composer,
Studio and MCP preparation evidence. It complements `/admin/studio` and `/admin/mcp`.
New UI text remains English. It never calls an LLM, buys credits or generates media.

## Using the review

1. Choose AI assistants, Studio or MCP preparations. Filter by account, conversation
   (Studio project / MCP quote), stored state, latest human verdict or issue tag.
   The media-model filter applies where the source records one selected model;
   Studio can select several models in its actions. Filtered conversations run
   oldest first. Other lists run newest first. Pages contain at most 50 records.
2. Inspect an entry. The GET page contains metadata only. Explicit **Reveal recorded
   content** authorizes a same-origin POST and commits an access audit before returning
   customer text. A missing audit table fails closed. Hide clears displayed content.
3. Read the submitted message, saved reply, proposed prompt (composer), historical
   settings/reference/guide context, per-call runtime, token usage and financial
   evidence. Technical completion, quote acceptance, media result and quality are
   distinct. Provider cost uses USD nanounits; reserved cents are not settled charges.
   Separately labeled provider output includes refused, incomplete or invalid replies
   and tool arguments, even when no validated reply exists. Large outputs are bounded
   and marked; absent fields are not labeled as oversized. Hidden reasoning stays out.
4. Record Useful / Needs work / Unreviewed, common issue tags and a short note.
   These are internal human judgments, not customer satisfaction or automatic scores.
   Saves are explicit/idempotent, retain earlier reviews, and recheck the source.
   Filters use the latest review; an old Needs work review does not override a later
   Useful review. Notes stay private and are scrubbed like other displayed text.

## Native evidence and capture

- Composer: `prompt_assistance_requests` keeps the submitted draft and its selected
  media model, mode, duration, resolution, format/audio settings, companion text and
  owned reference identities. Its existing `context_json` keeps the resolved guide,
  capabilities and actual reference perception; the new `reviewInput` captures the
  provider-facing textual input/history, instructions and tool/response-schema
  fingerprints. Funding/preflight failures after context preparation are explicitly
  `prepared_not_dispatched`; other saved manifests use `before_dispatch`, which is
  intent at the call boundary, not proof the provider received it. Reply and usage
  records determine what was subsequently observed.
- Studio: with `ASSISTANT_REVIEW_CONTEXT_ENABLED=true`, each new provider checkpoint
  stores `review_context_json` on its native response row in the same transaction as
  reservation, after applying the actual reserved output bound. Replay does not
  recapture or dispatch. This includes Lite continuations and schema fingerprints.
  Project facts, prior textual messages and tool results are bounded/redacted, not
  replayed as instructions by the reviewer. Existing Studio actions and provider
  usage remain separate sources. A missing snapshot does not erase available usage.
- MCP: only retained OAuth video/image preparations are projected from their native
  quote records. Prompt/settings/references/catalog revision and the exact owned
  job status are reviewable. No inference of a host conversation, host LLM, host
  reasoning, token cost or creative success is made. Other tool events, acquisition
  and errors remain in the existing operational MCP view.

`src/server/assistant-review/context.ts` owns the bounded projection: text budget,
depth/node/collection caps, credential/link removal (including nested token/cookie
fields and serialized tool JSON, with known reference-mention tokens preserved), omission of hidden reasoning
and media bytes. Media counts and the source's retained reference IDs are evidence;
they are not copies of the actual pixels/audio/video. Stored truncation propagates
to the UI. The scrubber is not a promise of anonymization: names and private prose
can remain. Reviewer access is therefore always authenticated and audited.

## Access, source lifecycle and activation

`frontend/server/admin-assistant-review` owns validation, native read adapters,
transactional access auditing and annotation writes. Route pages own `requireAdmin`.
The POST boundary rejects missing/foreign origins, non-JSON and streamed bodies over
12 KiB. Customer content is never a GET query parameter or a list-column value.
Responses are private/no-store. React escapes text; no HTML, external judging or
bulk raw export is offered. Optional missing evidence is unavailable, not empty.

Approve customer information, retention/deletion and reviewer access before
enabling live composer assistance or expanded Studio capture. Composer records
its provider-facing input/history in native request storage without the Studio
capture flag; leaving `ASSISTANT_REVIEW_CONTEXT_ENABLED` off does not disable
composer retention.

Apply **migrations 90 then 91** explicitly after Studio 52 and composer 85. Migration 90 adds the
nullable native Studio snapshot, a metadata-only access log and append-only review
annotations, plus their indexes. Reapplying it is safe. Do not run migrations from
readers. The existing Studio v1 quality-review reader enforces the same 90-day expiry. Enable the Studio capture
flag only after migrating its database through 91 and publishing the customer information. Composer capture uses existing storage.
Keep the flag off for rollback; do not erase historical financial evidence.

No production database, environment or capture policy is changed by this PR.
Source deletion remains authoritative: composer request/session and Studio
project/turn reads are exactly scoped and locked during review; deleted Studio
projects cannot be revealed or annotated. Snapshots are native row fields, so native
hard deletion removes them. The shared reviewer refuses detailed reveal and annotation after 90 elapsed days
from the source creation timestamp, even if cleanup has not run. Metadata remains
available. A 410 response clears already displayed details and unsaved notes.

## 90-day review-context cleanup

The user approved 90 days on 30 October 2026. This scope is deliberately limited:

- Composer: remove only `context_json.reviewInput`; preserve original input/reply,
  supplier response, guide/perception data and `maxChars` required for recovery.
- Studio: clear only `studio_conversation_responses.review_context_json`.
- Internal annotations: clear free-text `note` 90 days after its own creation;
  preserve verdict, issue labels, identity and timestamps. Access audit stays immutable.
- MCP: no additional snapshot is stored or purged; its shared-review access expires,
  while native operational quote records retain their existing lifecycle.

The fixed cutoff uses 2,160 elapsed hours against the database clock. Migration 91
allows only exact expired-field removal; it rejects early deletion, collateral
changes and re-population of an expired snapshot. Original workspace history,
media, provider evidence and financial rows are not subject to this cleanup.

`GET /api/cron/assistant-review-retention` runs hourly at minute 19 and requires a
nonempty `CRON_SECRET` plus the existing cron authentication. Each transaction
clears at most 100 rows per table, with locked rows skipped and no customer text
in the response. `hasMore` means another batch is needed; monitor successful runs,
failures and persistent backlog. A 503 is a failed cleanup, never proof of deletion.
Only trusted callers can invoke `cleanupAssistantReviewContext({limit,dryRun})`;
limit is 1–500 per table. `dryRun:true` uses a read-only transaction. HTTP query
parameters cannot change the cutoff or batch size. Missing schema fails closed.

Keep the cron and guard migration on runtime rollback so expired copies continue
to be removed. Do not replay migration 90 alone over 91: it would restore older
guards. Reapply 91 last if the migration runner replays history. Backup retention
and AI-provider retention remain separate; this is not a claim that all copies of
a conversation are erased at 90 days.

## Turning evidence into improvements

Use the same issue tags across all three sources to locate cases. A reviewer should
identify the faulty context field, reference interpretation, model guidance or tool
step, then change its shared owner and add a synthetic/redacted regression fixture.
Record the guide/instruction/schema version before comparing a later behavior.
Customer text is not automatically published, exported to training, or turned into
a rule. Compare outcomes with unknown/truncated cases retained; selected internal
reviews are not a representative success rate.

Still separate work: automatic linkage of composer Apply/Undo/Generate to a turn,
explicit customer ratings, full MCP tool-chain correlation or external transcripts,
audio MCP preparation stores, cohort-level quality/latency dashboards, and curated
evaluation datasets. The current UI labels these boundaries rather than inventing
missing context. The first delivery is the reviewable evidence and annotation base.

## Validation

Synthetic PostgreSQL tests cover native scope isolation, gated pre-dispatch Studio
capture and replay, composer rejected funding, missing audit storage, same-ID
conflicts, latest-review filtering, append-only history, deleted sources and MCP
origin/outcome separation. HTTP tests cover admin/origin/body bounds. DOM/browser
checks exercise explicit reveal/hide, escaping, failed-save retry, human evaluation
and desktop/mobile layout. Existing Studio review/assistance tests cover regression.
No customer conversations or provider calls are used as test fixtures.

Final increment validation: 46 focused checks passed after independent review fixes,
including malformed/refused/incomplete/oversized output review, nested credentials,
and null-versus-truncated evidence. TypeScript, targeted server lint, public exposure
and diff checks pass. The earlier full frontend lint has 0 errors / 7 existing warnings.
Required Quality CI remains a merge gate; this is not a full-repository green claim.


Retention increment qualification (30 October): 13 focused shared/legacy-review,
cron, retention and real composer PostgreSQL/DOM checks passed. Independent review
found one Important gap in the legacy Studio reveal path; a regression reproduced
the bypass, then passed after the shared database-clock boundary and 410 handling
were applied there too. No Critical or deferred Minor findings. The original
customer history and operational/financial viewers remain separate lifecycles.
