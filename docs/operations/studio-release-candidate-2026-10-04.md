# Studio + MCP release candidate — 4 October 2026

Status: implemented on `codex/studio-creative-workspace`; expanded validation is in progress.
**Not yet approved for production:** target-main integration, staging and final activation
remain explicit gates in the
[published-baseline reconciliation](studio-published-baseline-validation-2026-10-04.md).
No deployment, public plugin publication, production migration, real wallet debit or
credential change was performed. Live Sol/Luna text validation used the existing key under a shared $5 cap;
83 Responses calls cost $0.490465965 in calculated supplier usage, with no
unresolved hold. Paid media generation was excluded.
Create assistant work remains deferred. English is the primary product language.

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

Model recommendations use canonical catalog facts, supported actions and a versioned
editorial policy. Studio no longer has a separate five-model allowlist: it exposes
29 current and 10 executable legacy models, subject to runtime readiness and existing
certification. Current models are preferred for open briefs; legacy is labelled and
retained for explicit requests or an explained capability exception. Sora and
Seedance 1.5 are excluded from generation and have localized archive pages. The
[model coverage audit](studio-model-coverage-audit-2026-10-04.md) records the nine
current MCP models still outside Studio certification. No paid artistic benchmark
or new native-host certification was inferred.

## Verification evidence

The [expanded validation report](studio-human-validation-results-2026-10-04.md)
records 43 synthetic customer turns through the real Sol/Luna API, all failed
probes and corrections, 83/83 input-token count parity, financial simulations,
current live MCP observations and connected-browser checks. Calculated supplier
cost is $0.490465965 under the single $5 authorization; no media generation ran.

The combined product candidate is `66934ab3cc13cc6e5ecf6dc80c781435f647e862`.
Final full-suite, production build and public smoke results are being recorded
against this immutable source. The root's integrated focused check passed
**177/177 tests**, including the 78 model/mode pipelines, retirement/discovery,
archive metadata, canonical price evidence, director behavior and shared budget.
Fresh `pnpm mcp:client:check` passed **134 tests with one explicit unavailable
combined-validator skip**, plus all 70 offline policy scenarios. Neither this skip
nor those offline scenarios establish native-host certification.

The earlier `2e55deb63` full suite passed 6,070 tests with two explicit skips,
and its isolated production build generated 895 pages. Its EN/FR/ES Studio public
FAQ checks passed at 390/1440 pixels, matching visible FAQ text and JSON-LD, with
light public appearance and no overflow. These remain historical checkpoints;
their results are not attributed to the later catalog/public-archive changes.

The connected-browser pass at `eb581c5cd` verified direct conversation entry,
project selection, image attachment and mention without sending, explicit timeline
insertion, collapse and theme switching. It used synthetic authentication,
disposable PostgreSQL and local media. Real financial services were verified
separately against disposable databases; no customer wallet was used. Browser
appearance and media fixtures do not establish real authentication, production
balances, artistic quality or field Core Web Vitals.

The first expanded full attempt at `eb581c5cd` failed 11 standard tests before
isolated integrations ran. The failures led to complete public Sora retirement
and preserved historical pricing evidence. A later integrated focused run also
caught the matching Seedance 1.5 audit dependency; that was fixed without changing
frozen price fixtures or commercial arithmetic. Failure logs remain available.

The complete discovery plan comes from `node scripts/run-validation-tests.mjs
--plan`: 1,046 standard files at concurrency two, then four isolated Studio
integration files at concurrency one. Child fixture repositories unset
`GIT_WORK_TREE`; PostgreSQL 17, `TMPDIR=/tmp`, `LC_ALL=C`, and frontend React module
resolution are explicit. Local evidence stays in the uncommitted
`output/studio-creative-workspace/` directory.

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
ceiling. The later expanded dialogue review retains a minor Luna equipment assumption;
its price/capability findings received targeted follow-up. The staging, native-host,
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
3. Carry the verified Sol/Luna API entitlement and 83/83 token-count parity into
   the actual staging configuration; repeat a bounded account-level smoke there.
   Local live probes used standard/global processing and returned cache/output
   counters, but customer-visible wallet holds used disposable-database fixtures.
   Verify those holds and support reconciliation in the intended environment.
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
