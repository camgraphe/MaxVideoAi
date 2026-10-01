# Seedance proportional pricing — local acceptance, 2026-10-02

Branch: `codex/bytedance-pricing-grid`. This extends the
[local completion record](2026-10-01-pricing-local-completion.md) and the
[supplier accounting correction](2026-10-01-byteplus-contract-pricing.md).
All writes target the private Unix-socket review sandbox. Production activation
remains false; no push, merge, deploy, provider generation or external message
was performed for this correction.

## Decision and implementation

The user approved retaining each variant's positive gross margin percentage as
supplier consumption increases with a source video. Existing profitable customer
minima are preserved. Below-cost minima use the positive matching no-video
variant margin; edit/extend variants lacking that counterpart use the matching
text-output options. This is explicit price authoring, not a live markup rule.

One persisted customer rate covers all billable seconds, with the published
minimum and one final upward cent rounding. Quotes read that literal tariff and
trusted source duration. Missing trusted duration prevents a numeric quote.
Provider-reported tokens remain authoritative for actual supplier consumption;
the tested margins are estimates before payment and operating fees.

The admin displays the editable USD/billable-second rate, minimum, source/output
seconds, proposed total and estimated margin. It reuses preview, confirmation,
stale-review rejection, immutable events and rollback. Billing, public quotes
and MCP confirmation resolve the same continuous cell. Normal source tariffs
cover fractional durations up to 15s for 2.0 and 30s for 2.5. No-video and
Draft/final workflow tariffs remain separate.

Example: Standard 480p/16:9 with 4s output:

| Source duration | Estimated supplier cost | Customer total | Estimated gross margin |
| --- | --- | --- | --- |
| 2s, seven-second minimum | $0.302324 | $0.68 | 55.5% |
| 15s, nineteen billable seconds | $0.820595 | $1.85 | 55.6% |

The small margin variation comes from final cent rounding. The actual admin
browser shows the second row and the authored $0.09714285714285714/s rate.
Screenshot: `/tmp/maxvideoai-seedance-proportional-pricing.jpg`.

## Persistent local acceptance

The fingerprint-bound local append locked and reproduced its source state,
preserved all prior rows/history, then inserted the continuous classes and a
batch event. A private SQL backup was taken first.

| Evidence | Result |
| --- | --- |
| Appended continuous classes | 3,186 |
| Corrected below-cost minima | 273 |
| Active cell count | 14,982 → 18,168 |
| Local tariff revision | 328 → 3,514 |
| Reconstructed normal/workflow quotes | 20,437, no errors or legacy fallback |
| Unaffected quote amounts | 17,251 unchanged |
| Input-video stress cases | 6,372 accepted, zero below estimated cost |
| Product pricing inventory | All 38 records unchanged |

Private read-only evidence resides under
`.superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/`:
`current-supplier-audit-20261002.json` and
`seedance-proportional-acceptance-20261002.json`.
Append preview/apply receipts are `/tmp/mva-seedance-input-seed-preview.json` and
`/tmp/mva-seedance-input-seed-applied.json`. These are local evidence, not a
portable production seed.

## Verification

- Proportional authoring, source reconstruction, whole-domain rejection, local
  append and matching text-output margin fallback have focused passing tests.
- 74 admin/provider/media/MCP parity tests pass, including disposable PostgreSQL
  preview/confirmation, fractional and maximum source lengths, public/billing/MCP
  agreement, trusted-media rejection, stale review and immutable history.
- The optimized environment-free build of `d41f7269f` succeeds with 920 static
  pages. Its full standard run reports 6,715 passed, one failure and three skips.
  The failure exposed the old all-model initializer dispatching Seedance through
  the Wan compiler; that path has been corrected. The full suite has not been
  relabeled as a rerun of the subsequent correction.
- The corrected full-matrix local activation PostgreSQL regression passes. It
  reproduces the approved Seedance policy and GPT floors, rejects stale evidence,
  archives staged data, preserves history and checks active canonical quotes.
- Fourteen focused release/migration tests pass after the correction, including
  provider-specific amounts and factual route/region bindings without credentials.
- Current TypeScript, frontend lint, exposure lint and `git diff --check` pass.
- The actual browser verifies $0.68 at 2s source and $1.85 at 15s source. The
  existing local admin session is refreshed with its previously approved scope.

Logs: `/tmp/mva-seedance-parity.log`,
`/tmp/mva-seedance-migration-activation.log`,
`/tmp/mva-seedance-release-focused.log`,
`/tmp/mva-seedance-full-standard.log`,
`/tmp/mva-seedance-full-build.log`, and
`/tmp/mva-seedance-final-tsc.log` / `mva-seedance-final-lint.log`.

## Release boundary

Fresh all-model preparation requires the explicit reviewed Seedance margin
policy and records its deltas in the fingerprint-bound report. Locked activation
reproduces those prices. The local tools share factual configuration bindings
and accept only the isolated Unix socket. A declared alternate provider retains
its independent captured price and cost reference.

Before a separately authorized production release: confirm the account-effective
contract, capture real production overrides/quotes, review the exact proposed
input-price deltas and migrations, and run the normal PR/CI/deployment gates.
This local audit does not prove invoice costs, production parity or legal/routing
availability. Existing production release work remains pending.
