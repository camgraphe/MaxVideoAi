# Kling v3 Pricing and 4K Integration Audit

Audit date: 2026-04-25

## Executive Summary

Kling 3 is already present in the app and marketing catalogue as `kling-3-pro` and `kling-3-standard`, but its configured prices are stale. The current `frontend/src/config/falEngines.ts` values are exactly 2x the current fal.ai listed 1080p prices for Kling v3 Standard and Pro.

Fal also now exposes native 4K Kling v3 endpoints. These are not represented in the app catalogue, model pages, pricing data, benchmark specs, proxy allowlist output, or marketing copy. They should be integrated as separate routing variants/endpoints, not as a simple `resolution: 4k` option on the existing `v3/pro` and `v3/standard` endpoints.

## Current Fal Pricing Checked

Sources:

- `https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video`
- `https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video`
- `https://fal.ai/models/fal-ai/kling-video/v3/standard/text-to-video`
- `https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video`
- `https://fal.ai/models/fal-ai/kling-video/v3/4k/text-to-video`
- `https://fal.ai/models/fal-ai/kling-video/v3/4k/image-to-video`
- `https://fal.ai/models/fal-ai/kling-video/o3/4k/text-to-video`
- `https://fal.ai/models/fal-ai/kling-video/o3/4k/image-to-video`

Vendor rates shown by fal.ai:

| Fal endpoint family | Audio off | Audio on | Voice control | Notes |
| --- | ---: | ---: | ---: | --- |
| `v3/standard/*` | $0.084/s | $0.126/s | $0.154/s | Text-to-video and image-to-video match. |
| `v3/pro/*` | $0.112/s | $0.168/s | $0.196/s | Text-to-video and image-to-video match. |
| `o3/standard/*` | $0.084/s | $0.112/s | n/a on page | Stylized/anime-leaning O3 route. |
| `o3/pro/*` | $0.112/s | $0.140/s | n/a on page | Stylized/anime-leaning O3 route. |
| `v3/4k/*` | $0.420/s | $0.420/s | not listed | Native 4K, no separate upscaling step. |
| `o3/4k/*` | $0.420/s | $0.420/s | not listed | Native 4K O3 route. |

## Repo State

Kling 3 is configured here:

- `frontend/src/config/falEngines.ts`
  - `KLING_3_PRO_ENGINE`
  - `KLING_3_STANDARD_ENGINE`
  - app catalogue entries for both variants
- generated catalogue:
  - `frontend/config/engine-catalog.json`
- localized model pages:
  - `content/models/en/kling-3-pro.json`
  - `content/models/en/kling-3-standard.json`
  - `content/models/fr/kling-3-pro.json`
  - `content/models/fr/kling-3-standard.json`
  - `content/models/es/kling-3-pro.json`
  - `content/models/es/kling-3-standard.json`
- benchmark data:
  - `data/benchmarks/engine-key-specs.v1.json`
  - `data/benchmarks/engine-scores.v1.json`
- static pricing source:
  - `data/pricing.json`

Current configured Kling 3 rates in `frontend/src/config/falEngines.ts`:

| App engine | Current configured audio off | Current configured audio on | Current voice control | Current issue |
| --- | ---: | ---: | ---: | --- |
| `kling-3-standard` | $0.168/s | $0.252/s | $0.308/s | 2x current fal price. |
| `kling-3-pro` | $0.224/s | $0.336/s | $0.392/s | 2x current fal price. |

The public model-page content repeats those stale values in `pricingNotes`:

- Pro: `$0.336/s with audio, $0.224/s audio off, $0.392/s with voice control`
- Standard: `$0.252/s with audio, $0.168/s audio off, $0.308/s with voice control`

`data/pricing.json` currently has Kling 2.5 and 2.6 rows, but no Kling 3 rows. This creates a source-of-truth gap for audits/scripts that use `data/pricing.json` instead of `falEngines.ts`.

## Pricing Recommendation

Decide whether `pricingDetails.perSecondCents` stores vendor cost or customer price.

Observed pricing kernel behavior:

- `frontend/src/lib/pricing.ts` builds a pricing definition from `engine.pricingDetails`.
- The pricing snapshot then applies the active pricing rule margin, defaulting to platform margin behavior when no DB override exists.
- `packages/pricing/src/kernel.ts` also applies `platformFeePct`.

Because the kernel already has platform margin support, the cleanest model is:

- Store fal vendor price in `pricingDetails.perSecondCents`.
- Let the pricing rules/membership logic compute displayed/customer price.
- Keep marketing notes explicit: "vendor source rate before MaxVideoAI wallet margin" only in internal docs, not customer copy.

Suggested vendor values:

```ts
// kling-3-pro
pricingDetails: {
  currency: 'USD',
  perSecondCents: { default: 16.8 },
  addons: {
    audio_off: { perSecondCents: -5.6 },
    voice_control: { perSecondCents: 2.8 },
  },
}

// kling-3-standard
pricingDetails: {
  currency: 'USD',
  perSecondCents: { default: 12.6 },
  addons: {
    audio_off: { perSecondCents: -4.2 },
    voice_control: { perSecondCents: 2.8 },
  },
}
```

If marketing wants customer-facing "from" prices with the default 30% margin, the approximate member prices before discounts become:

| Engine | Audio off, 5s | Audio on, 5s | Voice control, 5s |
| --- | ---: | ---: | ---: |
| Kling 3 Standard | $0.55 | $0.82 | $1.00 |
| Kling 3 Pro | $0.73 | $1.10 | $1.28 |
| Kling 3 4K | $2.73 | $2.73 | n/a |

Exact displayed values should be generated by the pricing kernel because rounding and membership discounts can vary.

## 4K Integration Options

### Preferred: Separate App Variant

Create a distinct engine, likely `kling-3-4k`, instead of folding 4K into `kling-3-pro`.

Reasons:

- Fal uses separate model IDs:
  - `fal-ai/kling-video/v3/4k/text-to-video`
  - `fal-ai/kling-video/v3/4k/image-to-video`
- The 4K endpoint does not expose the same `resolution` parameter shape as the 1080p endpoints.
- Pricing is flat `$0.42/s` whether audio is on or off.
- Marketing positioning is different: native 4K delivery, professional/broadcast/export workflows.

Implementation shape:

- Add `KLING_3_4K_ENGINE` in `frontend/src/config/falEngines.ts`.
- Add modes:
  - `t2v` -> `fal-ai/kling-video/v3/4k/text-to-video`
  - `i2v` -> `fal-ai/kling-video/v3/4k/image-to-video`
- Set engine `resolutions: ['4k']`, `maxDurationSec: 15`, `audio: true`, `upscale4k: false`.
- In mode UI, set `resolutionLocked: true` but avoid passing a `resolution` parameter to fal if the endpoint rejects it.
- Set `pricingDetails.perSecondCents.default = 42`.
- Omit `audio_off` addon because audio on/off is priced the same on fal.
- Add it to the Kling variant group with a higher/lower discovery rank depending on desired funnel.

### Optional: Separate O3 Variant

Add `kling-o3-4k` only if the product wants a stylized/anime route:

- `fal-ai/kling-video/o3/4k/text-to-video`
- `fal-ai/kling-video/o3/4k/image-to-video`

Do not mix this into the standard Kling 3 4K entry unless the UI clearly explains the stylistic routing difference.

## Marketing Surfaces To Update

Must update:

- `frontend/src/config/falEngines.ts`
  - Correct `KLING_3_PRO_ENGINE` prices.
  - Correct `KLING_3_STANDARD_ENGINE` prices.
  - Correct `pricingHint` values for both cards.
  - Add `kling-3-4k` if approved.
- Regenerate:
  - `frontend/config/engine-catalog.json`
  - `frontend/config/model-roster.json`
  - `docs/model-roster.json`
  - `docs/model-roster.csv`
- `data/pricing.json`
  - Add Kling 3 Standard/Pro 1080p rows.
  - Add Kling 3 4K rows.
- `data/benchmarks/engine-key-specs.v1.json`
  - Add `maxResolution: 1080p` to existing Kling 3 Standard/Pro entries.
  - Add a new `kling-3-4k` entry with `maxResolution: 4K`, native 4K, 3-15s, T2V/I2V, native audio.
- `data/benchmarks/engine-scores.v1.json`
  - Add scores only after a real eval pass; avoid copying Pro scores blindly.
- localized content:
  - `content/models/en/kling-3-pro.json`
  - `content/models/fr/kling-3-pro.json`
  - `content/models/es/kling-3-pro.json`
  - `content/models/en/kling-3-standard.json`
  - `content/models/fr/kling-3-standard.json`
  - `content/models/es/kling-3-standard.json`
  - new `kling-3-4k.json` pages if creating a public model page.
- compare surfaces:
  - `frontend/config/compare-hub.json`
  - `frontend/config/compare-config.json`
  - `frontend/config/model-families.ts`
  - comparison links in adjacent model pages if 4K becomes indexable.
- SEO/watch surfaces:
  - `frontend/config/video-seo-watchlist.ts`
  - sitemap timestamp config if pages become indexable.
- proxy/test surfaces:
  - `frontend/src/lib/fal-model-policy.ts` updates automatically from `listFalEngines()`, but tests should assert the new 4K endpoints are allowed.
  - `tests/fal-model-policy.test.ts`
  - `tests/pricing-definition.test.ts`

## Risk Notes

- Current `generateViaFal()` normalizes `resolution: '4k'` to `2160p`. For native 4K Kling endpoints, avoid sending `resolution` unless fal's API schema explicitly accepts it.
- Current Kling 3 image mode remaps `image_url` to `start_image_url`; this matches v3 4K image-to-video docs, so it should continue to work.
- Current validation has special `kling-3` element checks for `i2v`; a new `kling-3-4k` ID would still match `startsWith('kling-3')`.
- Voice control pricing is not shown for the native 4K endpoint; do not expose a voice-control surcharge until verified.
- `data/pricing.json` has stale `last_checked_at` dates and no Kling 3 entries, so pricing audits may miss the active Kling 3 app prices.

## Recommended Rollout Sequence

1. Patch Kling 3 Standard/Pro vendor prices in `frontend/src/config/falEngines.ts`.
2. Update localized `pricingNotes` for existing Kling 3 pages.
3. Add `data/pricing.json` rows for existing Kling 3 endpoints.
4. Run pricing tests and add explicit assertions for Kling 3 Standard/Pro.
5. Add `kling-3-4k` as a separate engine behind `surfaces.app.enabled = false` or limited if we want a soft launch.
6. Verify one 4K text-to-video and one 4K image-to-video request payload in a non-production environment.
7. Enable the app variant and publish model/compare/catalog surfaces.
