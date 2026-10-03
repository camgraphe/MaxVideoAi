# Studio + MCP release candidate — 4 October 2026

Status: implemented on `codex/studio-creative-workspace`, awaiting final production
review. No deployment, public plugin publication, production migration, live model
call, real wallet debit or credential change was performed. Create assistant work
remains deferred. English is the primary product language.

## Customer experience

- `/app/studio` opens the latest owned conversation directly. A first visit creates
  one empty saved project through the existing idempotent command. A failed read
  never masquerades as an empty account. Projects open in a compact searchable
  dialog; classic Canvas, templates and existing handoffs remain available.
- The centered creative chat and tilted reference arrangement remain. Media can be
  previewed, expanded, attached or mentioned without submitting anything. **Add to
  timeline** is a separate explicit action using measured media and the existing
  revisioned edit command. Timeline read refresh cannot hide an edit failure.
- Appearance lives in the common app menu. With no explicit choice it follows the
  device; public pages stay light. Stored preference, first paint, blocked storage,
  keyboard interaction and account/project lifetimes have dedicated checks.
- The assistance control shows Sol or Luna, remaining included percentage or paid
  budget. It explains how to continue, permits explicit reauthorization of an
  existing stopped budget, and can stop paid assistance while old usage settles.
  Luna has a persistent label and a contextual reminder around generation quotes.
- EN/FR/ES `/studio` pages describe the actual private preview, with an authenticated
  entry handoff, localized metadata/FAQ, assistant-cost disclosure and a real current interface capture. There
  is no universal public-access, unlimited-assistance or artistic-benchmark claim.

## Commercial policy implemented, not activated

| Item | Initial gated policy |
| --- | --- |
| Included Sol | One-time per-account allowance capped at $1 supplier exposure |
| Included Luna | One-time per-account allowance capped at $0.25 supplier exposure; continuing assistance, not only conversation wrap-up |
| Aggregate sponsored campaign | $100 supplier exposure, including pending/unknown calls |
| Paid Sol | Explicit spending ceiling drawn from the existing MaxVideoAI wallet |
| Customer rates, USD per million tokens | $7.50 noncached input; $0.30 cached input; $30 output including reasoning |
| Customer rounding | Sum the model calls in one client message, then round up to the next cent |
| Customer budget choices | Add $5, $10 or $20 where allowed; at most $20 outstanding authorization including pending reservations |
| Automatic charging behavior | No automatic budget increase, wallet recharge or model switch |
| Media generation / film export | Existing exact quote and separate confirmation; unaffected by included assistant usage |

The included dollar amounts are internal maximum costs, not redeemable wallet
credit. Customers see percentages. A conservative next-call reservation may stop
work before that percentage reaches zero. The paid tariff is three times the
conservative standard supplier basis (about 66.7% contribution before infrastructure,
payment fees, taxes and support); this is not an all-cost profit forecast. Actual
conversation length, cache behavior and tool use determine consumption.

The maximum four dispatched model responses per message includes retries. Exhausted
settled work gets a truthful partial reply and a new-follow-up action. Neither a
budget change nor an interrupted connection automatically repeats completed actions.
Unknown provider usage keeps its reserve until authoritative reconciliation.

Full owners, exact conditions and recovery procedure are in
[Studio assistance accounting](../engineering/studio-assistance-economics.md).
Tariff, policy and supplier rates have separate versions; retain historical facts
and review unsettled calls before changing their interpretation. Never revise an
old ledger row to make a new tariff appear retroactive.

## Audit and improvement

`/admin/studio` provides paged metadata and scoped inspection of retained visible
Studio turns. Revealing submitted text and the saved reply requires a distinct
admin POST; a metadata-only access audit must commit first. Unknown/unavailable
sources stay labelled. Provider cost ranges, monetary reservations and settled
customer charges are separate. Hidden reasoning, raw provider outputs, raw tool
payloads, URLs and secrets are excluded from the review projection.

This provides a usable review foundation, not complete historical replay. Full
prompt/context/schema manifests, annotation workflows and systematic quality
metrics remain future work. External MCP host transcripts are not available;
`/admin/mcp` covers server-observed activity. See
[admin review ownership](../engineering/admin-studio-review.md).

MCP global instructions were reduced from up to 12,937 to 1,762 UTF-8 bytes, measured
across 128 capability combinations. Relevant operation guidance stays with its tools;
exact quote approval and recovery remain enforced. The new `pnpm mcp:client:check`
gate runs offline before plugin release. Old release artwork is archival rather
than current product proof. See the [MCP audit and update procedure](studio-mcp-release-audit-2026-10-03.md).

Model recommendations retain the existing versioned editorial policy and explicit
customer preference. Current catalog facts, executable modes and quote authority
remain separate from artistic judgments. No paid artistic benchmark or new native
host certification was inferred from these tests.

## Verification evidence

The core production implementation was built at `247e3b6d6`. Candidate
`2e55deb63` additionally clarifies assistant costs in the public EN/FR/ES FAQ;
its isolated prebuild, production build and sitemap generation also passed.
Only the handoff and plan status change after this production build. A fresh
independent reviewer examined the release diff and
rechecked both discovered defects after fixes: stopped-budget reauthorization and
saved-response recovery after repeated settlement-storage failure. Both have
reproduction tests; no important finding remained in the reviewed changes.

- Isolated production prebuild, Next.js build (895 static pages), types/lint and
  sitemap generation passed. Six native-image lint warnings and the existing
  Supabase Edge/Browserslist warnings remain; they are not build errors.
- Real connected-project Chromium checks passed for owned media insertion, direct
  entry, project popup, new project, theme switching and no document overflow at
  320/390/768/1440 pixels. No page exceptions. Budget-dialog/browser checks used
  explicit mock assistance responses; actual money behavior was checked separately
  against disposable PostgreSQL, never against a customer wallet.
- Production-mode public browser checks at `2e55deb63` passed in EN/FR/ES at
  390/1440 pixels. The assistant-cost FAQ opens in all six cases and its answer
  exactly matches the localized JSON-LD. The 48,132-byte optimized hero loads;
  pages stay light even with dark OS/app preference,
  and no page exceptions or horizontal overflow were observed. These are local
  functional checks, not field Core Web Vitals or a comparative performance claim.
- The sanitized production browser lacked cookie-policy database data and local
  Vercel analytics endpoints; their 500/404 responses are recorded as fixture limits.
- The complete standard discovery plan (1,037 test files) passed: 6,061 tests,
  6,059 passed, zero failed, two explicit skips. The absent combined Codex plugin
  authoring validator and opt-in multitrack local-render test are the skipped
  cases; neither is claimed as executed. Skill validation and separate real
  connected-browser/render checks did run. All four isolated Studio integration
  files then passed: 11 tests, no failures or skips. Combined: **6,072 tests,
  6,070 passed, zero failed, two skipped**. The runner exited successfully.
- Fresh `pnpm mcp:client:check`: 121 passed, one unavailable-validator skip, and
  all 70 offline policy scenarios passed. Final exposure and TypeScript checks
  passed; the final production build also ran lint and type validation.

The final broad run is `release-validate-candidate.log`, using the complete plan
from `node scripts/run-validation-tests.mjs --plan`, with standard concurrency two
and isolated integration concurrency one. `GIT_WORK_TREE` was unset for child
fixture repositories; `TMPDIR=/tmp` and PostgreSQL 17 were used. Earlier runs are
retained: inherited Git fixture configuration, outdated browser selectors and
archival release-art fixture assumptions were corrected before the successful run.
No production behavior was weakened to satisfy those fixtures.

Local verification artifacts are in `output/studio-creative-workspace/` (not
committed): production-build summaries, browser screenshots/results, focused logs,
MCP policy results and the full validation log. They contain controlled fixture data.

## Execution decisions

- Work remains on the isolated feature branch for the user’s final review. No
  production action was inferred from permission to finish implementation; rollout
  therefore still needs a separate controlled step.
- Co-evolving owners were integrated in one coherent candidate commit, followed
  by bounded correction commits. This made the first review diff larger; a fresh
  independent reviewer reviewed the integrated behavior.
- Broad tests use the repository’s exact discovery plan with concurrency two for
  standard files and one for isolated Studio integrations. Unbounded local
  PostgreSQL instances exhausted macOS shared memory. No test file was omitted;
  the tradeoff is longer validation, not less coverage.
- Unknown provider usage never authorizes a replacement request. Fully settled
  partial work is saved and offers an explicit new follow-up. This can require an
  extra message, but prevents repeated edits or charges from a silent resend.
- Public artwork is a real interface capture with a demonstration-media caption.
  It proves the rendered appearance, not production availability, model quality
  or real-world performance.

The independent review’s two actionable defects were corrected, with reproductions:
existing paid-budget resumption and saved-response settlement after the retry
ceiling. No reviewer minor finding remains deferred. The explicit live-provider,
rollout and wider learning-system limitations above remain outside this candidate’s
local verification.

## Final production review and activation

The [distribution rollout checklist](studio-mcp-distribution-rollout-2026-10-04.md)
records fresh external state and the subsequent GitHub, Registry, ClawHub, n8n and
directory updates. In particular, reconcile this branch's 0.3.5 package metadata
with the already-published 0.3.6 source before choosing a new release version and
qualifying the merged candidate. The local checks above do not certify that merge.

1. Approve the commercial policy above and the included-campaign amount. The
   implementation remains disabled by default; Studio public access remains gated.
2. Apply migrations 54 and 55 to the intended staging environment through the normal
   migration process. Readers never initialize schema. Check real cookie/legal
   configuration, wallet reporting and existing admin role access there.
3. Qualify the actual Sol/Luna account and token-count/response parity with bounded
   authorized usage. Confirm standard/global processing, cache counters, output
   usage, representative creative tasks and customer-visible wallet holds. Offline
   mocks prove orchestration, not real creative quality or provider entitlement.
4. Exercise support reconciliation with authoritative provider evidence before paid
   public access. Unknown reservations must never be expired or refunded merely
   because a timeout elapsed. Review customer-content use and audit-log retention.
5. Recheck target MCP clients against the update guide before claiming a new client
   certification or publishing a plugin. Deployment, packaging and store listings
   are distinct release steps.
6. Activate only the reviewed environment: `STUDIO_ASSISTANCE_ENABLED=true`; in
   production also set `STUDIO_ASSISTANCE_APPROVED_POLICY=studio-beta-2026-10-03-v1`.
   Changing Studio access flags or public availability is a separate rollout decision.

Rollback: disable new assistance dispatch through the feature gate and preserve
ledger/receipts/response checkpoints for recovery. Do not drop financial evidence,
reset grants, silently change model, or replace an unknown request with a new paid
request. This document records the handoff; it does not authorize deployment.
