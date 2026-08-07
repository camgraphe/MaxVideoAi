# Task 5 report — Seedance 2.5 public flagship publication

Date: 2026-08-07
Status: DONE — implemented, generated, and fully verified; commit pending at the time this report was written.

## Outcome

Seedance 2.5 is now published across every registry-owned public surface. The registry owns a typed `launchBadge?: 'new'`, projects it into runtime publication metadata, and enforces that the badge can only appear on a published app entry.

The implementation stays within publication, discovery, pricing projection, generated roster/indexation artifacts, and the directly affected architecture contracts. It does not change provider or generation behavior.

## Owner-approved scope decisions

Two conflicts surfaced during TDD and full-suite validation and were explicitly resolved by the task owner:

1. Seedance family ranks already used rank `3` for Seedance 1.5 Pro. The owner approved shifting Seedance 1.5 Pro from `3` to `4`, giving the complete order `2.5=0`, `2.0 Standard=1`, `2.0 Fast=2`, `2.0 Mini=3`, `1.5 Pro=4`.
2. The first complete validation run exposed twelve stale downstream contracts. The owner approved a targeted extension limited to derived counts/lists, the additive Seedance 2.5 pricing-shadow fixture, assertions that still expected closed 2.5 surfaces/pricing, and the three localized decision primary CTA destinations. Detailed Task 7 marketing copy and Task 9 comparison content remain out of scope.

## TDD evidence

The prescribed registry/readiness test command first ran red:

```text
33 tests: 29 passed, 4 failed
```

The failures covered the missing badge schema/projection, the previously closed Seedance 2.5 publication surfaces, and the missing flagship rank. After implementing the schema and registry policy, the duplicate family-rank contract revealed the pre-existing Seedance 1.5 Pro collision; the approved rank shift resolved it.

Final focused registry/readiness result:

```text
33 tests: 33 passed, 0 failed
```

The regenerated public pricing fixture initially made the pricing projection contract fail only on the stale expected row count (`492` instead of `504`). After updating that derived assertion, the focused pricing result was:

```text
12 tests: 12 passed, 0 failed
```

The first full-suite run then identified the twelve stale downstream contracts noted above. After the owner-approved targeted updates, the focused downstream set passed `94/94`, followed by the final complete suite passing `2456/2456`.

## Authored changes

- `frontend/config/model-registry-validation.ts`
  - Adds `launchBadge?: 'new'` to app publication metadata.
  - Rejects every badge value other than `new`.
  - Rejects a badge on an unpublished app surface.
  - Keeps presentation-only and retired entries badge-free.
- `frontend/config/model-publication.ts`
  - Adds the typed field to `AppPublicationConfig`.
- `frontend/config/model-runtime.ts`
  - Carries the registry field through `toLegacyModelSurfaces`.
- `frontend/config/model-registry.json`
  - Opens every Seedance 2.5 public surface.
  - Sets examples rank `0`, app discovery rank `-3`, variant group `seedance-2-0`, variant label `2.5`, and launch badge `new`.
  - Sets pricing featured scenario `seedance-2-family`.
  - Sets suggested and published comparison opponents to Seedance 2.0, Kling 3 Pro, and Veo 3.1.
  - Adds only the required reciprocal published pairs.
  - Preserves Seedance 2.0's existing suggested opponent order.
  - Applies the owner-approved family ranks described above.
- `content/models/{en,fr,es}/seedance-2-5.json`
  - Points the existing decision primary CTA to `/app?engine=seedance-2-5`.
  - Leaves detailed launch copy for Task 7.
- `scripts/pricing-audit.ts`
  - Audits the immutable legacy shadow fixture together with the new additive publication fixture.
- `tests/fixtures/pricing-shadow-additions.v1.json`
  - Adds four Seedance 2.5 publication-shadow scenarios without rewriting the 178 legacy scenarios.

## Generated artifacts

The required registry generators were run successfully:

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
```

Generated registry projections:

- `frontend/config/model-runtime.json`
- `frontend/config/engine-catalog.json`
- `frontend/config/model-roster.json`
- `docs/model-roster.json`
- `docs/model-roster.csv`

The public pricing baseline was regenerated to `tests/fixtures/pricing-public-projections.v1.json` with:

```bash
pnpm pricing:public-baseline:generate
pnpm pricing:public-baseline
```

The official comparison indexation generator, invoked by the architecture tests, regenerated:

- `docs/seo/comparison-indexation-matrix-2026-07-08.json`
- `docs/seo/comparison-indexation-matrix-2026-07-08.md`

Those artifacts add exactly the three new reciprocal pair slugs in three locales (`9` localized URLs), all as `noindex_candidate`; no detailed Task 9 comparison content was authored.

## Public pricing proof

The baseline changed from `492` to `504` rows. A semantic comparison against `HEAD` showed:

- `12` rows added.
- Every added row belongs to `seedance-2-5`.
- `0` rows removed.
- `0` pre-existing rows changed.
- `0` pre-existing cent values changed.

Added rows:

| Surface | Scenario | Cents / availability |
| --- | --- | ---: |
| Estimator | Member | 103 |
| Estimator | Plus | 98 |
| Estimator | Pro | 93 |
| JSON-LD offer | Default | 103 |
| Model page | Default | 103 |
| Pricing hub | 10s / 1080p | unavailable |
| Pricing hub | 10s / 1080p / audio | unavailable |
| Pricing hub | 10s / 720p | 578 |
| Pricing hub | 4K | unavailable |
| Pricing hub | 5s / 720p | 289 |
| Pricing hub | 8s / 1080p | unavailable |
| Entry route | Default | 578 |

The additive shadow fixture contributes four scenarios: billing member `103`, billing plus `98`, billing pro `93`, and estimator `103`, each with vendor cost `79` and the expected margin. The complete pricing audit passes `182/182` scenarios with zero mismatches across four profiles.

## Contract updates

Tests were added or updated for badge validation/projection, full Seedance 2.5 readiness, public pricing projection, comparison indexation counts, examples route lists, Seedance publication lists/order, localized public CTA destinations, and the additive pricing-shadow fixture.

The updated tests are:

- `tests/model-registry-validation.test.ts`
- `tests/model-registry-parity.test.ts`
- `tests/seedance-2-5-readiness.test.ts`
- `tests/pricing-public-projection.test.ts`
- `tests/comparison-indexation-matrix.test.ts`
- `tests/comparison-indexation-wave-1.test.ts`
- `tests/examples-route-architecture.test.ts`
- `tests/seedance-prelaunch.test.ts`
- `tests/seedance-2-5-marketing-page.test.ts`
- `tests/pricing-shadow.test.ts`

## Verification

All required and relevant checks passed:

```text
pnpm model:registry:check    PASS — 42 models, 2 tombstones, all projections current
pnpm model:check             PASS — 41 roster entries, 0 critical findings, 9 warnings
pnpm models:audit            PASS — 0 critical findings, 9 warnings
pnpm pricing:public-baseline PASS — 504 rows current
pnpm pricing:audit           PASS — 182/182 matches, 0 mismatches, 4 profiles
pnpm test:validate           PASS — 2456/2456 tests
npm --prefix frontend run lint PASS
npm run lint:exposure          PASS
git diff --check               PASS
```

The nine model-audit warnings are pre-existing/non-critical content quality or family-resolver warnings: the Gemini Omni Flash and hidden BytePlus Seedance family resolver warnings, plus thin closing-CTA warnings for GPT Image 2, Kling 2.6 Pro, Kling 3 Pro, Kling 3 Standard, Nano Banana, Seedance 1.5 Pro, and Seedance 2.5.

## Self-review and deferred work

- Confirmed there are no provider or generation implementation changes.
- Confirmed the frontend and docs roster JSON projections match.
- Confirmed the generated pricing diff is additive and isolated to Seedance 2.5.
- Confirmed the comparison matrix adds only the three required reciprocal pairs.
- Restored the timestamp-only `docs/model-roster-report.md` audit change, so it is not part of this task.
- Seedance 2.5's detailed localized marketing copy still contains pre-launch wording, and the existing primary CTA labels remain unchanged even though their destinations now open the engine. This is intentionally deferred to Task 7 per the approved scope.
- No push or deployment was performed.
