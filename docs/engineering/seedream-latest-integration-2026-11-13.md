# Seedream latest integration — 2026-11-13

The implementation adds canonical `seedream-5-5` and `seedream-5-0-flash`
identities to ByteDance/BytePlus, shared by app, MCP, Studio and localized
marketing. Both expose t2i/i2i, one output, ten references, 1K/1.5K/2K (default
2K) and JPEG/PNG. Seedream 5.5 defaults to PNG and offers native background
control. Transparent output requires PNG before pricing or wallet reservation.
Layer decomposition and OCR are outside this integration.

## Ownership

- `src/config/fal-engines/seedream-latest.ts`: new factual mode schemas.
- `lib/image/seedream.ts`: shared family recognition, output guard and rasters.
- `src/server/images/byteplus-seedream-*`: existing direct provider execution.
  Engine identity accompanies custom endpoint IDs, retaining the correct limits.
  New reference slots preserve order and repeated inputs already included in the
  quote; existing Lite/Pro normalization and receipts remain unchanged.
- `src/server/images/image-generation-normalization.ts`: enum/output validation
  before pricing. The executor delegates this owner and retains its size limit.
- `lib/image/seedream-pricing.ts` and canonical tariff readers: dated supplier
  facts and 39 versioned launch cells. See the
  [pricing evidence](seedream-55-flash-pricing-2026-11-13.md).

## Existing search pages

`/models/seedream` and `/models/seedream-5-0-pro` retain their identities and
EN/FR/ES public URLs, title, description, hero title and primary CTA. The new
pages have their own URLs, canonical metadata and localized links. No replacement
redirect, retirement or fabricated model example is introduced.

All 24 title/canonical/hreflang/robots comparisons between the six live existing
pages and local rendering matched. All twelve localized old/new pages returned
200 with self-canonical URLs, reciprocal alternates and valid JSON-LD. Local
development rendering respects the repository's localhost normalization setting.
Native-browser inspection checked both French pages and deferred prompting
content; the generic hero is explicitly an illustration.

## Validation and publication

Focused provider, real composer, MCP/Studio, pricing and SEO tests passed,
including canonical parity on disposable PostgreSQL 17. Frontend build, TypeScript,
MCP client check, exposure lint and independent code review passed. Subsequent
complete suite results are recorded after the final candidate checks finish.

No production database change, provider activation, paid generation, merge or
deployment was performed. Account authorization and an approved paid canary
remain separate release checks; public documentation is not execution evidence.

Publication follows the repository's ordinary GitHub PR and Vercel Git delivery
policy. Local source and test readiness do not establish deployment or actual
provider execution.
