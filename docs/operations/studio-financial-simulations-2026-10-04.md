# Studio financial interaction simulations — 2026-10-04

The focused assistance suite passed on the local release-candidate worktree:
**27 tests passed, zero failed, zero skipped** across ten test files. Five new
human interaction sequences exercised the real conversation service and PostgreSQL
ledger with injected token counts and provider responses. No product defect was
reproduced by these additions; no production owner was changed for this work.

This is financial orchestration evidence, not live-provider qualification or a
creative-quality score. No production database, environment, customer wallet,
provider credential, publication or deployment was used. The separately authorized
live-provider budget was not consumed by these simulations.

## Run identity and reproduction

- Base commit: `7ffa8d8c4e420cd7cd9d5e5745cf2bbfda09b669` on
  `codex/studio-creative-workspace`, plus the new test file below. Other concurrent
  worktree changes were left intact; this document does not certify them.
- Date: 2026-10-04 Europe/Madrid; verification timestamp
  `2026-10-03T22:58:30Z`.
- Node `v22.23.2`, pnpm `10.18.2`, PostgreSQL `17.6` (Homebrew).
- New coverage: `tests/studio-assistance-human-sequences-postgres.test.ts`.
- Real service: `createImageConversationService`, durable response/action
  checkpoints, assistance accounting, receipt wallet and migrations 30, 39, 49,
  50, 51, 42, 52 and 54. Fixtures only supply prerequisite project/receipt schema.
- Every model invocation and token count is injected. SQL runs against disposable
  PostgreSQL over a private temporary Unix socket; the database is stopped and
  removed after the run. Test concurrency is one.

From the feature worktree root:

```sh
env -u GIT_WORK_TREE \
  PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/bin:$PATH" \
  TMPDIR=/tmp \
  pnpm exec tsx --tsconfig frontend/tsconfig.json \
  --test --test-concurrency=1 tests/studio-assistance-*.test.ts \
  > output/studio-creative-workspace/financial-assistance-focused.log 2>&1
```

Observed result: exit 0; 27 passed, zero failed/cancelled/skipped; runner duration
8,079.926333 ms. The new file alone passed six TAP tests (its parent plus five
scenarios), exit 0, in 1,684.834208 ms, retained in
`output/studio-creative-workspace/financial-human-sequences-first.log`.

An initial command omitted `--tsconfig frontend/tsconfig.json` and failed to
resolve `@/lib/db` before any scenario ran. Correcting the test invocation resolved
that setup failure. It is not a product regression or a RED/GREEN bug fix.
`git diff --check` also passed. The full repository run remains separate.

## New sequences and observed outcomes

The controlled provider facts are 100 noncached input tokens and 50 output tokens,
with no reported cache-write counter. Counting returns a conservative 1,000 input
tokens, while the real director sets a 2,200 output-token bound. A first paid Sol
call therefore reserves eight cents; these small fixture responses settle at one
cent per message. A second response within the first message adds no customer
cent because the message's aggregate remains below one cent before rounding.
These deliberately small responses test arithmetic and state transitions; they do
not estimate normal conversation cost.

| Human sequence | Observed behavior | Count calls / model dispatches |
| --- | --- | --- |
| Double Send, reconnect, Sol → Luna during a paid response, then Luna → Sol during its response | Same request returns `thinking`; another request is rate-limited; reconnect reads the saved state. Both calls in the original message remain paid Sol. The next request uses Luna even when the account switches back mid-flight. The following request uses paid Sol. Same ID with changed content is rejected. The remembered brief changes exactly once. | 4 / 4 |
| Two simultaneous budget authorizations, then stop during token counting | Exactly one authorization commits; the stale revision is rejected. Stopping before reservation leaves zero response checkpoints, calls, action rows or charge receipts. An explicit reauthorization and new message succeed. | 2 / 1 |
| Stop while a paid tool response is in flight | The dispatched response settles for one cent and its brief update is saved once. The next paid dispatch is blocked. A truthful saved partial reply survives reconnect and retry without additional counting or charging. Explicit Luna selection sends nothing; a new follow-up sees the prior message and partial reply. | 3 / 2 |
| Included Sol exhausted, then paid authorization without wallet funds | Both attempts fail before dispatch, with safe-new-request recovery and no financial/checkpoint/action residue. An explicit new Luna request works. A later wallet top-up does not change the selected model or send a message. Explicit Sol authorization then permits a new paid request. | 4 / 2 |
| Unknown saved usage, stop budget, reconnect, then reconcile | The full eight-cent hold remains; the saved tool has not run. Lowering the budget to seven cents is rejected. Read/retry preserves the hold and does not redispatch. Trusted injected evidence settles once and refunds seven cents. Recovery after the retry ceiling performs the saved brief update once, closes the partial turn, and cannot dispatch another response. Paid authorization stays disabled. | 1 / 1 |

The exhausted-grant fixture deliberately starts its account with a zero Sol
allowance. It tests recovery from an exhausted account without spending through a
full grant. All other fixtures use the documented $1 Sol / $0.25 Luna / $100
campaign limits and $20 maximum outstanding authorization. Paid authorizations
in these tests are an absolute 100 cents through the real service seam; browser
button sizes are covered separately by the existing dialog/client tests.

## Actual simulated receipt and usage ledger

All figures below are **fixture USD cents**, taken from the PostgreSQL queries
printed in the TAP diagnostics. “Gross charge” includes wallet reservations and
is not recognized assistance revenue. Net debit equals gross charges minus
refunds and agrees with settled `charged_cents`.

| Fixture account | Wallet funded during scenario | Gross charge receipts | Refund receipts | Settled customer cents | Final balance | Final unresolved hold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `model-switch` | 1,000 | 23 | 21 | 2 | 998 | 0 |
| `preflight-revoke` | 1,000 | 8 | 7 | 1 | 999 | 0 |
| `tool-revoke` | 1,000 | 8 | 7 | 1 | 999 | 0 |
| `unfunded-recovery` | 100, after initial failures | 8 | 7 | 1 | 99 | 0 |
| `unknown-recovery` | 1,000 | 8 | 7 | 1 | 999 | 0 |
| Total | 4,100 | 55 | 49 | 6 | 4,094 | 0 |

Before trusted reconciliation, `unknown-recovery` had a 992-cent wallet balance,
eight cents reserved, zero settled cents, one unknown call, zero refunds and zero
completed brief updates. Budget revocation and retry did not alter those amounts.
After reconciliation and saved-response recovery it had a 999-cent balance,
one settled cent, seven refunded cents, no unresolved reservation and exactly one
brief update. Repeating settlement did not issue another refund.

Ten simulated responses were dispatched: seven Sol and three Luna. Numeric usage
facts record a Sol supplier interval of 700,000–750,000 nanodollars per response
and a Luna interval of 35,000–37,500. The upper/lower distinction is preserved
because the injected usage omits the cache-write counter. These are calculated
fixture facts, not provider invoices or live usage.

## Existing coverage reused

The same fresh focused run included the existing ledger, checkpoint and real
service recovery PostgreSQL tests: per-account and cross-account campaign
contention, isolated account grants, cumulative subcent rounding, unknown transport
outcomes, frozen funding, revoked authorization, token-count failure, saved reply
recovery after repeated settlement outages, mixed known/unknown usage, the four-call
cap and action idempotency. Existing pricing, route, director, dialog, hook and
client tests also passed. Their earlier evidence was not substituted for this run.

## Bounds and remaining evidence

- Barriers reproduce specific ordering at token counting and provider completion;
  this is deterministic race coverage, not a throughput/load benchmark or an
  exhaustive exploration of every interleaving.
- These tests invoke real service entry points and persistence, not a browser or
  HTTP deployment. They establish server-side consequences of the human sequences;
  they do not establish rendering, real network reconnect behavior, accessibility
  or session-cookie correctness.
- The trusted reconciliation response is injected through the internal settlement
  seam. This verifies settlement and recovery semantics, not provider evidence
  retrieval or a complete support operations workflow. Unknown holds without
  authoritative evidence still must not expire automatically.
- No actual Sol/Luna entitlement, token-count/response parity, cache behavior,
  regional pricing, provider latency or artistic quality is established here.
- Media generation and film-export consent, execution and supplier bills are
  outside these assistance-only simulations. No media jobs or exports are created.
- No product failure was observed, so there is no product RED/GREEN claim. The
  additional tests guard previously uncovered combinations of existing behaviors.
  The separate release-candidate and engineering guides remain the policy and
  activation references; this report does not authorize rollout.
