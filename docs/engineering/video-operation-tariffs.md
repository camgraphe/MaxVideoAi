# Video operation tariff maintenance

Reviewed scope, 2026-10-24. This maintenance extends the current USD standard
policy (30% margin, zero flat/audio/upscale surcharge) through the canonical
calculator. It does not change existing literal prices or activate providers.

| Addition | Cells | Quantity / qualified output |
| --- | ---: | --- |
| Kling 4K Reference | 13 fixed | Requested 3–15 seconds, 4K |
| Kling Edit | 3 continuous | Measured 3–15 seconds; Standard 720p, Pro 1080p, 4K |
| H3 Recast | 2 continuous | Measured 5–30 seconds; 768P, 1080P |
| H3 Relight | 4 continuous | Measured 56/24–15 seconds; 480P, 768P, 1080P, 2K |
| Luma Extend | 3 fixed | Five new seconds, 540p 20¢ / 720p 39¢ / 1080p 156¢ |
| FLUX Keyframes | 48 fixed | Requested 5–20 seconds; standard 720p/1080p, Draft 720p |
| FLUX FAST | 1 continuous | Exact source seconds, strictly positive and less than 15; 720p |
| FLUX Draft Enhance | 1 continuous | Exact owned paired native Draft seconds, positive through 21 inclusive; 1080p |
| LTX 2.3 Reframe | 2 continuous | Exact source seconds, positive through 60 inclusive; 720p/1080p |
| Veo Standard I2V | 12 fixed | 4/6 seconds × 720p/1080p/4K × audio off/on |

Total: 89 additions, 76 fixed and 13 continuous. The historical 26,982 monetary
checkpoints remain separately asserted; exhaustive fixtures cover 27,071 total.
Six existing Veo I2V eight-second anchors remain unchanged: 720p/1080p 208¢ silent,
416¢ audio; 4K 416¢ silent, 624¢ audio. Explicit Standard/Pro Kling Reference and
omitted operation retain the same historical selector. Default new identities
(4K Reference, Luma Extend, Keyframes, LTX Reframe) select their exact new cells.
H3 Extend/Insert/Reframe are excluded. H3 Max Create still accepts integer 5–15
seconds; no fractional creation domain is activated here. Native Draft Extend
remains available but its cache class is not qualified for paired Enhance.
The Enhance 21s bound is an application admission rule accommodating measured
cadence, not a provider timing or invoice guarantee.

## Exact authoring and source settlement

`frontend/server/pricing/video-operation-continuous-tariff.ts` calls the existing
canonical standard calculator in maintenance only and uses `compileBoundedUnitBands`
to freeze every representable customer-cent transition. Runtime consumes literal
`input_video_seconds` bands with coefficient/divisor 1, preserving exact source
quantity. Tests check every transition and both adjacent doubles, admitted minima
and maxima, strict FAST maximum, measured fractional examples and alternate cadence.
The domain guard checks each band's upper neighbor against the monotonically
normalized reference subtotal, covering its entire admitted interval.

Canonical standard rounds the reference subtotal nearest, rounds the margin
upward using its existing epsilon, then rounds the final total nearest. Historical
manual settlement instead defaults to `ceil(raw - 1e-9)`. Near zero those policies
can disagree: FAST 1.1111111111111113e-9 seconds yields a raw reference subtotal
3.333333333333334e-9 cents and a canonical customer amount of zero, while the old
manual default would require one cent. Narrowing source admission or changing the
customer band would change the reviewed contract.

New additions, including Veo I2V 4/6s, refuse inactive or empty tariff grids.
Only strict new source-operation engine/mode/operation/endpoint identities select
`referenceSubtotalRounding: 'nearest'` through the server tariff resolver. Request
metadata cannot choose this policy. `supplierReferenceExactCents`, the raw breakdown,
and `effective_supplier_charge_verified: false` preserve the factual published
estimate. Normalized settlement is not supplier invoice evidence. Historical manual
callers retain their default ceil rule; no historical quote/settlement/refund changes.
The generic pricing package's optional rounding input is a trusted server parameter.

Zero-cent mathematical bands pass canonical confirmation, job reservation and
idempotent known-rejection refund. They do not imply that real media probes produce
arbitrarily small clips. Exact billed source seconds remain in the canonical snapshot.
Studio reuses the same canonical byte-qualification helpers after strict owned-asset
locking and rereading; stored display metadata never replaces measured source facts.
The legacy integer `app_jobs.duration_sec` column is a display projection only;
reservation checks the operation binding and canonical source quantity and rejects
caller duration or a substituted operation/source. Paired Enhance uses its separately
qualified owned Draft quantity. Accepted recovery and refunds use the original
reserved price, even after a tariff revision changes.

## Bounded release procedure

Use a clean checkout of the exact published candidate, containing current fetched
`origin/main`. Preserve unrelated untracked work by using a separate maintenance
checkout. The command reuses the existing release Git and PR gates. Apply requires
an open matching repository PR with completed successful `Quality CI` for that SHA;
the checks run again before commit. Environment and receipt paths must be outside
the checkout, including resolved symlinks. Never store credentials in the repository.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/initialize-video-operation-tariffs.ts preview --environment /private/release.env --actor ADMIN_UUID --candidate FULL_40_CHARACTER_SHA --release-branch codex/video-provider-mode-parity --review /private/video-operation-review.json
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/initialize-video-operation-tariffs.ts apply --environment /private/release.env --actor ADMIN_UUID --candidate FULL_40_CHARACTER_SHA --release-branch codex/video-provider-mode-parity --review /private/video-operation-review.json --pr PR_NUMBER --approve-fingerprint REVIEWED_64_CHARACTER_FINGERPRINT
```

Preview is read-only, repeatable-read and requires the existing administrator. It
rereads current active tariffs and effective policy; revision 1798 is historical
observation, not an application assumption. The receipt binds target identity,
actor, candidate, branch, revision, full prior grid/policy hash, explicit scope,
reference basis and every literal proposed cell. The target identity and release
branch participate in the approved fingerprint
itself: changing either requires fresh preparation and approval, even for identical
cloned grid/policy/cell bytes. Both are also retained in the immutable event. The
receipt remains `approved: false` and `activationReady: false`; it never claims
provider qualification or deployment.
Review the exact prices before supplying its fingerprint. Do not edit receipt fields.

Apply rechecks the receipt and administrator, locks state/cells/version history/policy,
rejects any existing target selector, reproduces the complete fingerprint, writes
89 cells through the canonical store, verifies all prior rows unchanged and all new
quotes against persisted rows/revision, then inserts one immutable pricing event.
Partial insert or audit failure rolls back the transaction. Replay after commit is
rejected by revision/event fences without another mutation. If completion is uncertain,
inspect the immutable `video-operations:bounded-current-policy-initialization` event
before retrying; do not blindly rerun or invent an ad hoc SQL repair.

For rollback, stop new submissions through existing provider gates and use the
normal reviewed code-release rollback. These additions have no prior price to
restore: there is no automatic batch-delete rollback for this create event, and
active tariff deletion is deliberately forbidden. Keep dormant literal rows and
immutable history; do not remove prices while the corresponding offers remain
admitted. A subsequent per-cell correction needs the existing canonical admin
preview/confirmation/version workflow and current-state fences. Original reserved
quotes/refunds remain valid. Root/operator owns external application, schema 79
qualification, feature flags and live release verification. No local test establishes
production readiness or verified provider invoice cost.
