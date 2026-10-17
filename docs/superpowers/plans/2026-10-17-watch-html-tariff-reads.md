# Watch HTML tariff reads implementation plan

**Goal:** Remove repeated transactional tariff reads from public video HTML responses, verify desktop gain and preserve mobile behavior.

**Architecture:** Keep the existing reader, eligibility, metadata and canonical pricing kernel. Coalesce concurrently requested exact tariff selectors into one read-only repeatable-read snapshot scoped to that quote batch; every later batch reads fresh state. No response cache, price cache across requests, SQL migration or media change.

**Evidence:** Current production source 8211b9d22ccbd198ecc94efa50a69b77ed61faac; read-only probes under `.reports/watch-html-lcp-20261017/`. Three real watch detail projections wait 2.4–3 s after watch data; CPU profiling shows waiting, not comparable CPU work. Full SEO catalog reads remain a separately measured cost.

## Constraints and review focus

- Exact/continuous selector matching, historical interval order, revision, inactive tariffs and fail-closed errors match the existing selected reader.
- A malformed selected row affects only that selector; unrelated rows never enter the batch.
- No table locks or writes; all data commands execute within one REPEATABLE READ READ ONLY transaction.
- Later batches and separate readers observe edits. Returned states cannot share mutable row objects.
- Existing current-price policy checks, configured capabilities, URLs, metadata, poster, geometry and mobile playback remain authoritative.

## Tasks

- [x] Add real PostgreSQL regression coverage for a four-command selector batch, parity, malformed rows, continuous selectors, snapshot consistency and subsequent edits. Run red before implementation.
- [x] Add `loadCustomerTariffQuoteStates(selectors)` and a microtask-scoped coalescer to the tariff store. Wire the optional selector reader through `computeCanonicalBillingSnapshot` and the watch quote context. Retain existing single-quote and operational executor paths.
- [x] Run selected-reader, temporal, quote, workspace recreation and watch contracts; confirm frozen current-quote parity and actual SQL counts.
- [x] Compare baseline/candidate production builds using the same database in read-only mode, routes, network/CPU and media: three cold and warm visits per device, plus canonical/schema/geometry and first-Play checks.
- [x] Document individual samples, variability, source identity, remaining costs and limits. Run lint, typecheck, exposure, relevant integration and financial validation. Obtain a whole-patch review before completion.

Execution: native in this isolated worktree, within the user's authorized correction and measurement scope.


Final evidence: `docs/performance/2026-10-17-watch-html/README.md`. The primary comparison is 24 audits between matched Vercel Preview builds with correct device User-Agents; earlier limited protocols and adverse samples remain documented. Both complete financial tests pass locally; the stable initial-cutover rerun accepts all 26,818 checkpoints. Final independent review confirms the measurements and reports no unresolved defect. Production delivery is outside this change; required Quality CI remains a premerge gate.
