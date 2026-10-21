# FLUX 3 Max customer tariff initialization

Prepared on 2026-10-20. This document and the initializer do not activate tariffs.

The customer decision is the normal fal list rate plus 30%: 17 US cents/second at 720p and 29 cents/second at 1080p, multiplied by 1.30 and rounded up once to whole cents for the clip. The fal launch promotion is excluded. The amount is frozen as a literal `fixed` customer tariff; later supplier-price or promotion changes do not recalculate it.

| Resolution | 5 seconds | 10 seconds | 20 seconds |
| --- | ---: | ---: | ---: |
| 720p | $1.11 | $2.21 | $4.42 |
| 1080p | $1.89 | $3.77 | $7.54 |

Scope: 128 exact selectors covering `t2v`, `i2v`, `fl2v` and `ref2v` (keyframes), every integer duration from 5 through 20 seconds, and both resolutions. Orientation, audio and keyframe count are unpriced dimensions in the canonical facts. The canonical coverage collector and quotation reader must agree before any cell can be persisted. Any coverage gap, changed normal supplier rate or existing Max tariff (including inactive history) blocks this initialization. Existing prices require a separately reviewed admin change.

The workspace sends `inputs: []` for Max preflight because these prices do not use image identity, count, dimensions or duration. This also lets a reviewed public keyframe recipe reach quotation without fabricating library ownership for its public image URLs. The restored images, their order and frame positions remain in the generation payload and undergo its normal validation. The strict persisted-reference preflight schema is unchanged for other models; in particular, reference-priced Grok still sends every reference and rejects an unresolved asset. If Max gains media-dependent pricing or owned-media requirements, its preflight projection must be reviewed alongside that contract change.

Primary price evidence: <https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video>, checked 2026-10-20. The advertised supplier promotion ends November 7, 2026, without a confirmed cutoff time/timezone. No expiration job is needed for these customer cells, because they never use the promotional supplier rate. Supplier accounting and any later negotiated offer are separate decisions.

## Offline projection evidence

`tests/fixtures/flux-3-max-public-pricing-launch-2026-10-20.json` adds 12 Max projections without rewriting the frozen public pricing baseline. Its model page, estimator tiers and Product offer all use the normal list rate plus 30%; 4K remains unavailable. Run `pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/pricing-flux-3-max-launch.ts` to reproduce it through the canonical collector. `--write` is only for an intentionally reviewed fixture refresh, and never writes tariffs.

`pnpm pricing:shadow-additions:generate` adds the four canonical audit scenarios to the existing publication additions file. The audit's historical membership-tier projector is retained for compatibility and does not define current customer prices. The live customer tariff initializer and the public launch projections have no membership discount. The 178-row pre-canonical fixture and the historical public fixture remain unchanged.

## Preview and activation

Use an authorized existing admin UUID and an explicitly selected environment file. Keep the environment file and private review receipt outside the repository. Follow the repository's production authorization policy before executing `apply`. These commands are operational examples, not evidence of execution.

1. Publish the exact release candidate on its `codex/` branch with a clean checkout. The candidate must contain the complete four-mode runtime, and descend from `origin/main`.
2. Create a read-only repeatable-read preview against the explicitly selected target. The receipt includes database identity, source revision, actor, candidate SHA, fingerprint, policy and all 128 literal amounts. The file is created exclusively with mode 0600.

   ```bash
   pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/initialize-flux-3-max-tariffs.ts preview --environment /private/release.env --actor ADMIN_UUID --candidate FULL_40_CHARACTER_SHA --review /private/flux-3-max-review.json
   ```

3. Review the exact receipt and obtain the required operational authorization. `Quality CI` must pass for this PR's exact candidate SHA. If the tariff-state revision or candidate changes, generate a new preview and review it again.
4. Apply only the approved receipt, explicitly repeating its fingerprint:

   ```bash
   pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/initialize-flux-3-max-tariffs.ts apply --environment /private/release.env --actor ADMIN_UUID --candidate FULL_40_CHARACTER_SHA --review /private/flux-3-max-review.json --pr PR_NUMBER --approve-fingerprint REVIEWED_64_CHARACTER_FINGERPRINT
   ```

The writer locks the admin identity and tariff state, checks the exact source revision, locks tariff/rule tables, regenerates the candidate and compares the fingerprint. It writes cells and the immutable `flux-3-max:normal-list-initialization` pricing event in one transaction. Git and input files are checked again before commit. No route, build or deployment invokes the writer. The customer tariff reader remains fail-closed while cells are absent.

After activation, read the immutable event and verify public quotes for all four modes, with 5/10-second examples at both resolutions. This preparation did not query or modify a production database, create generations, or validate an operational preview. If an apply command loses its completion response, inspect the immutable event before retrying; existing cells block a second initialization.
