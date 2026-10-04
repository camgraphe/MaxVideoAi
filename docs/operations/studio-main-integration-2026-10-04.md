# Studio + MCP main integration — 4 October 2026

The owner authorized continuing integration and release qualification after the local candidate handoff. This record supersedes the earlier “no integration performed” status only for the operations recorded here; it does not claim production or package publication.

## Source reconciliation

Merged target `5251f4d3f826da175ed1c334e0c8e3e10b3fc82a` into the Studio candidate `f2e03df16`. All 107 conflicted paths were reviewed by responsibility. Current-main model/provider/pricing/editorial/gallery/authentication changes and the production Git provenance gate are preserved alongside Studio's conversation, assistance, private media and MCP features. Dependencies use the merged frozen lockfile (Next 15.5.25, Sharp 0.35.4).

The reconciliation found two compatibility issues beyond textual conflicts: historical Mini trial validation through the mixed quote reader, and versioned video measurements losing original-file provenance during a library copy. Both received focused regressions. Local login preserves both the one-level PKCE route and the chosen language. The admin navigation keeps main's compact grouping and adds Studio interaction review to Overview.

Package 0.3.7 is a local release candidate. Fresh GitHub and official Registry reads confirmed 0.3.6 as published/latest and 0.3.7 unused. Public-site installation metadata points to published 0.3.6 until the new artifact is actually available. No tag, release, Registry record or external listing has been changed.

## Environment checkpoint

Production still serves GitHub main `5251f4d3f826da175ed1c334e0c8e3e10b3fc82a`, deployment `dpl_Gmbi8ZZuajWdQWparYELy8Nec2ne`, on both `maxvideoai.com` and `api.maxvideoai.com`. No production configuration or data was changed.

The existing protected `maxvideoai-studio-pilot` project (`prj_YfetGQTdeFzHBjiEagQEgI4KyQtU`) has its own schema-only Neon branch `br-twilight-sea-ae32jnf3`, private storage and preview-scoped credentials. Migrations `54_studio_assistance_ledger.sql` and `55_admin_studio_review_access.sql` were applied there as one targeted transaction. Verification found zero assistance accounts/calls/choices/review events, the immutable-call trigger and the review index. The first transaction submission was rejected before execution because the connector accepts one SQL statement per array entry; splitting the exact migration sources into 14 statements succeeded. No historical wallet/project/media rows were changed.

The separate public MCP staging project's five schedules remain paused. Its discovery and authorization discovery endpoints return 200. It has no Studio assistant configuration and has not been redeployed by this work.

## Validation status at integration commit

Focused backend, archive/marketing, login and MCP checks passed, including disposable PostgreSQL scope tests. The current pricing baseline retains 577 rows. MCP client checks passed 150 tests plus all 70 offline policy scenarios, with the existing optional Codex validator skipped. Initial integrated TypeScript, model-registry, frontend lint and exposure checks passed; lint retains six existing native-image warnings. The complete integrated 1,308-file standard suite and four isolated Studio files, final build and hosted qualification follow this commit. Earlier candidate test totals do not certify this new merge.

The OpenAI text validation ceiling remains the original cumulative $5. Settled usage before hosted qualification is $0.490465965, with no unresolved reservation. This integration has made no new model call, paid media generation or render dispatch.

## Qualification after integration

Integration commit `a3c996f754fda181a3b9c406a197110f373cf78d` was pushed to draft
[PR #377](https://github.com/camgraphe/MaxVideoAi/pull/377). Its isolated production
build completed all prebuild, Next build/type/lint and postbuild stages. The
Git-backed Vercel preview `dpl_Cof66nu1a86YVdM5uvLHdjwufYQT` became READY. Seventeen
local HTTP checks and nineteen protected hosted HTTP checks passed, including the
previously unqualified database-backed Veo/Wan pages and delivered sitemap. This
is public-route evidence, not authenticated Studio acceptance.

The first complete integrated local run reported 7,309 tests: 7,290 passed,
15 failed and four skipped. The failures included nested/cascading assertions,
not fifteen separate defects. The correction pass preserves the architecture
and canonical catalog contracts:

- An admin daily-series fixture pins its disposable database and fixture session
  to UTC, matching its asserted UTC day keys.
- Fal queue-log status normalization moves into the existing status owner,
  keeping the handler below its 690-line architecture limit.
- Historical 0.3.3 artwork retains main's exact archival placement and claim.
- Wan prompt-expansion defaults and GPT image MIME, extension and size constraints
  are asserted in the current Studio projections. Explicit prompt-expansion
  choices are verified through the real provider-body builder.
- H3's image-to-video alternatives allow a start or end frame. The matrix uses
  that canonical requirement, and Studio now correctly infers image-to-video
  for an end-frame-only request. Each reference role retains its provider field.
- The selected-media recovery test keeps the new Wan default through interruption,
  retry and confirmation, including the provider payload.

Independent review also identified a missing account-restriction gate for
conversation supplier work. A strict preflight stops restricted accounts before
token counting; a transactional recheck stops restrictions committed during that
preflight before funding reservation. All three funding modes are covered.
Saved responses, settlement, refunds and replay remain recoverable after a later
restriction. Eleven PostgreSQL cases and the broader 38 assistance checks pass;
independent review found no actionable blocker. The safe existing error envelope
returns `ACCOUNT_RESTRICTED`, not an invitation to switch budgets.

The original GitHub browser and exhaustive financial lanes passed. Fast checks
reported the same projection/architecture/archive failures above; their first
failed run is retained as evidence. The final corrected source must receive a
new immutable CI run before merging. Neither the first local result nor the
previous candidate's success is presented as a passing final suite.

The pilot assistance schema is ready, but hosted authenticated acceptance is
still pending. Existing Vercel Secret values cannot be read back; no protection
was downgraded to recover them. The pilot can reuse its existing runtime
configuration. No new model call, production activation, source tag or MCP
package publication has occurred at this checkpoint.

## Hosted account and CI environment qualification

Corrected product source `8469309b6b79b501a5c32a8fd7bee2cdb0aaa336` passes
132 affected catalogue/webhook/recovery checks, final TypeScript/registry/exposure
checks and frontend lint (six existing warnings). Four isolated Studio route cases
also pass. Its Git-backed public preview built successfully, and GitHub fast and
browser lanes passed.

A separate protected pilot deployment `dpl_HwWLLG8kCQQ3SkfQMvwypc4BeZ1E` runs the
exact committed archive with production schedules removed and a noindex header.
The existing disposable staging Auth identity was signed in through its normal
password endpoint, using its Keychain credential and publicly served client
configuration. Only this candidate uses that staging Auth configuration; the
existing owner pilot and production Auth were not changed. The test identity has
an isolated pilot profile and admin role, no imported wallet balance, no copied
customer content and no fabricated legal acceptance.

Authenticated HTTP acceptance verifies one idempotent empty Project, a creative
Sol reply, explicit selection of Luna, a useful simpler follow-up and durable
conversation reads. Reposting the same Sol request returns the same saved reply:
the ledger remains one provider call with exactly the same settled cost. A video
recommendation probe against the image-only pilot correctly reports the closed
video capability rather than inventing availability. A second candidate enables
the media gate for the separate catalogue probe; no confirmation/export endpoint
is used. Production gates remain unchanged.

The full finite Sol/Luna allowance for this test account ($1.25 supplier exposure)
is reserved in the original cumulative $5 journal before hosted calls. Actual
settled usage and unresolved holds are reconciled from the isolated assistance
ledger; this is not a second $5 authorization. Existing pilot media remain five
jobs, ten receipts and two exports. No media dispatch, synthetic credit, customer
wallet charge or render is part of this qualification.

The integration CI lane also revealed an environment classification defect:
`connected-studio-conversation-render-integration.test.ts` uses Chromium through
`executablePath()` and Remotion, but the lane selector recognized only direct
browser launches. The database lane did not install Chromium. Reproduction with
an empty browser directory failed promptly but left Remotion's concurrently
created server alive. The correction assigns the test to the browser lane and
fails before bundling/server creation when its required binary is missing. This
preserves mandatory real rendering coverage; it does not skip the test or extend
a timeout to conceal the missing dependency.

Read-only production schema preflight at 01:17:47 UTC found all prerequisites,
553 OAuth quotes (none with a null client), no new Studio tables/columns, and no
competing locks. The seven exact Studio migrations must run in one bounded
transaction before candidate readers are deployed: 49, 50, 51, 52, 53, 54, 55.
Use `lock_timeout=5s` and per-statement `statement_timeout=60s`. The quote table
receives an ACCESS EXCLUSIVE lock through commit; the observed table is about
2.1 MiB. The migrations do not debit wallets, backfill customer content, mutate
jobs or convert existing projects. Preserve this additive schema on rollback;
after Studio quotes exist, retain origin-aware readers. Do not replay migration
49 or the blanket migration runner after video/audio Studio rows exist.

The real hosted admin reveal endpoint also returned the exact synthetic submitted
message and saved Sol reply, with a recorded access ID and explicit partial
coverage. Its response excludes raw provider output, encrypted content and storage
URLs. This test used only the dedicated test identity's own Project.

The media-enabled pilot `dpl_4KhqmQHAx7A2iRqhVZzbG54hDVbK` subsequently returned
an action-specific video recommendation after reading the live catalogue and
model details: Seedance 2.0 for a five-second text-to-video draft, with compatible
alternatives. No generation or quote was created. Switching the capability gate
between probes caused the assistant to call its earlier unavailable-video answer
incorrect; that earlier answer was accurate for the image-only configuration.
This is a recorded conversational limitation, not a failed catalogue lookup.

All seven hosted provider calls settled, with 32,489 tokens and $0.07292985 in
supplier cost; the test account was charged $0. The single cumulative validation
journal now contains 90 Responses calls, $0.563395815 settled and no outstanding
hold, below the original $5 ceiling. The pilot retains five jobs, ten receipts
and two exports, unchanged. Four synthetic conversation turns and one explicit
admin-review access were added. The temporary staging session file was removed.

The Git-backed preview of `c72a1187d32843f8e539424f6007011c52f0d3fb` passes all
19 hosted public-route checks, covering Studio and MCP in three languages,
current Veo/Wan model pages, nine model archives and the delivered sitemap.
Archived Sora pages remain historical documents; they do not advertise an
executable generation offer. This source fixes CI browser classification without
changing the hosted pilot's product code. Final required CI and the production
transaction, merge, deployment and protected plugin publication remain separate
release gates; none is implied by these preview results.

The final catalogue audit found that `recommendedByDefault` still reflected only
current lifecycle, contradicting Pika's existing `on_request` editorial policy.
List, details and recommendation selection now share the same eligibility rule.
Pika remains discoverable and eligible when explicitly requested and compatible;
its default flag is false. Explicit preferences cannot restore legacy,
deep-legacy or retired entries to the recommendation shortlist. This changes no
model identity, provider capability or price. Regression tests observed the Pika
flag failure before the fix; focused checks and independent review pass afterward.
