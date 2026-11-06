# Gemini Omni Flash 1.2 customer-price release

The approved customer policy is **the saved 1.1 customer price × 1.5**, with one
round-up to a whole USD cent. This is a 50% retail increase before cent rounding,
not a markup on Google's new supplier cost. Supplier accounting remains separate.
This source change prepares the release; no production tariff was changed.

## Complete scope and concrete amounts

A read-only production capture on November 5, 2026 established 456 active Omni
classes: 416 fixed prices and 40 continuous token-band prices. The latter contain
5,999 literal customer amounts. The complete 544-scenario canonical projection
of that capture passed locally. Raw target identity and the capture remain in
ignored private review storage, not in this repository.

Text-to-video examples, with no input image or source clip:

| Resolution | 3s: 1.1 → 1.2 | 5s: 1.1 → 1.2 | 10s: 1.1 → 1.2 |
| --- | ---: | ---: | ---: |
| 360p | $0.14 → $0.21 | $0.23 → $0.35 | $0.45 → $0.68 |
| 720p | $0.40 → $0.60 | $0.67 → $1.01 | $1.32 → $1.98 |
| 1080p | $0.60 → $0.90 | $0.99 → $1.49 | $1.98 → $2.97 |
| 4K | $1.19 → $1.79 | $1.98 → $2.97 | $3.96 → $5.94 |

The same rule covers image-to-video, all 1–10 reference-image choices, first/last
frames, edit, extend and retake. Existing 3–10s, resolution, source and reference
boundaries are retained. Editing's fractional source/output duration is preserved.

For a fixed price, only `customerCents` changes. For token bands, each final saved
`customerCents` changes; `minUnits`, `maxUnits`, divisor and the 1.1 token expression
stay identical. Consequently **every value inside each interval** retains the
old price boundary and receives exactly `ceil(old cents × 3 / 2)`. Multiplying
supplier coefficients or continuous-second rates would not preserve that rounding
contract and is deliberately rejected by this release owner.

## Ownership and verification

`frontend/server/pricing/omni-12-tariff-release.ts` owns preparation and the explicit
transactional application. It accepts the complete current USD fixed/band grid;
missing, duplicate, future, versioned-exception or changed-form cells fail closed.
The review binds the source revision and contents, actor, exact candidate commit,
target database identity and commercial policy. Changed inputs require a new
preview. The maintenance command also requires a clean published candidate,
current main ancestry and successful exact-candidate Quality CI.

Application locks the tariff state and relevant tables, appends all 456 previous
versions, updates current cells and records one immutable pricing event in the
same transaction. The event prevents a second multiplication even after a fresh
preview. If completion is uncertain, inspect
`gemini-omni-flash:1.2-customer-price-release` before retrying. A later rollback or
commercial revision is a separately reviewed operation, never a second launch.

Disposable PostgreSQL checks cover stale revision/fingerprint, a mid-batch failure
and complete rollback, old-version preservation, other-model isolation, canonical
public/billing equality, unchanged stored quote values and replay refusal. Existing
customer-tariff revision controls reject stale new submissions and preserve owned
paid continuation/refund snapshots. No new runtime pricing formula is introduced.

Marketing prices, comparison points, estimators, Product offers and example
recreation quotes continue to use the canonical public quote owner. They must use
the newly activated saved cells, not the legacy supplier-derived development
projection. A source-only development preview without active tariffs is therefore
not acceptance evidence for these retail amounts.

## Explicit release sequence

Follow `docs/deployment/github-vercel.md`. These commands are instructions, not
evidence that production was modified.

1. Publish and validate the exact candidate on its clean `codex/` branch. Fetch
   current main and reconcile concurrent changes before release. Preserve the
   original account probe's limited live-coverage claim.
2. Prepare a read-only preview using an explicitly selected environment and an
   existing authorized admin. Keep the environment and review receipt private.

   ```bash
   pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/release-omni-12-tariffs.ts preview --environment /private/release.env --actor ADMIN_UUID --candidate FULL_40_CHARACTER_SHA --review /private/omni-12-review.json
   ```

3. Coordinate the tariff change with the 1.2 deployment while new Omni submissions
   are disabled. The selected maintenance environment must explicitly contain
   `GOOGLE_VERTEX_OMNI_ENABLED=false` for `apply`; this local file alone is not proof
   that deployed traffic is disabled. Keep polling/recovery on stored paid attempts.
   Apply only the reviewed receipt after exact-candidate Quality CI succeeds.

   ```bash
   pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/release-omni-12-tariffs.ts apply --environment /private/release.env --actor ADMIN_UUID --candidate FULL_40_CHARACTER_SHA --review /private/omni-12-review.json --pr PR_NUMBER --approve-fingerprint REVIEWED_64_CHARACTER_FINGERPRINT
   ```

4. Complete the normal GitHub merge → Vercel Git build/deployment with the new
   tariff state in place. Do not re-enable submissions until model, Pricing,
   comparison, estimator/API and JSON-LD prices agree with the receipt in EN/FR/ES.
   A standalone CLI does not call Next.js cache invalidation: deployment and
   verification of the rendered prices are part of this coordinated release. If
   cache refresh is needed, use the existing tariff surface revalidation owner in
   the authenticated Next.js operational context; do not multiply prices again.
5. Verify both public domains against the merged commit and exercise a fresh
   quote/charge plus an already-paid continuation. Historical receipts and videos
   remain attributed to their original version and paid amount. Check the immutable
   tariff event and re-enable the direct route only after acceptance.

The development task ran only read-only production inspection and disposable
database writes. Production activation, invoices and the coordinated deployment
remain unexecuted.
