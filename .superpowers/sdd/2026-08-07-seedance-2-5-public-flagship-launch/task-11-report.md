# Task 11 report — Seedance 2.5 indexation, sitemap, metadata, and social card

Date: 2026-08-08
Status: DONE — implemented and verified; commit recorded in the task handoff.

## Outcome

Seedance 2.5 now uses the accepted City poster as the localized model-page
Open Graph and Twitter image. EN, FR, and ES author the same
`/models/seedance-2-5-launch.jpg` path through their existing `seo.image`
field. The existing model route remains the metadata owner; `page.tsx` did not
need a change.

The focused contracts lock all three Seedance 2.5 self-canonicals,
`index,follow`, reciprocal EN/FR/ES/x-default hreflang, localized Product
Offers, Open Graph/Twitter image projection, and models-sitemap membership.
They also lock the three existing Seedance 2.0 self-canonicals and sitemap
entries so the 2.5 launch cannot displace 2.0.

No provider request, generation, payment, media mutation, push, deployment, or
registry policy change was performed.

## Social-card source and provenance

The source was resolved read-only through the existing public application
playlist `examples-seedance-2-5`:

- Playlist result count: exactly two public/indexable items.
- Selected item: first result, playlist order `1`.
- Runtime identity: engine `seedance-2-5`, 24 seconds, 16:9.
- Prompt identity: exact City opening from “The city in the suitcase”; prompt
  SHA-256 `ef90bf67d33f8f99ac320ad2e9dc07e4f8e5b2adeb1507378fa0ad37893bad70`.
- Acceptance provenance: `docs/model-launch/seedance-2-5.md` records City as
  “Accepted for marketing — product-owner signoff” with durable video,
  preview, and poster present.
- Source transport: existing stable public, non-signed MaxVideoAI media JPEG;
  no provider URL or signed URL was used or recorded.

Downloaded temporary source inspection:

```text
Format: JPEG, baseline, RGB, no alpha
Dimensions: 1280×720
Size: 58,297 bytes
SHA-256: 75ba55d7bfbcaf3d9229f6f48ab0d1839f7528f791e6033bfd53abf02e0cd1e5
```

The final asset was exported mechanically with ffmpeg in one image-processing
pass: centered 1280×672 crop (24 pixels removed from the top and bottom), then
Lanczos resize to 1200×630 and JPEG encoding. There was no generated artwork,
text overlay, retouching, compositing, or semantic content change. Original
and final images were inspected side by side; the woman, suitcase, station,
lighting, and framing remain intact.

Final asset:

```text
Path: frontend/public/models/seedance-2-5-launch.jpg
Format: JPEG, baseline, RGB, no alpha
Dimensions: 1200×630
Size: 66,666 bytes
SHA-256: c17b2713a166ef89b6d51284ce998b601543d2701eff0f1e902c9eb106d53383
```

## TDD evidence

The first sandboxed test command could not create the tsx IPC socket and did
not count as RED. The standalone Node sitemap import also required an identity
shim for React 18's unavailable server-only `cache` export; the model sitemap
builder never executes the unrelated video-SEO branch.

After correcting that test harness issue, the valid RED result was:

```text
Focused SEO tests: 23 total, 21 passed, 2 failed
Failure 1: frontend/public/models/seedance-2-5-launch.jpg did not exist
Failure 2: localized seo.image was undefined instead of the launch path
```

After the three localized JSON fields and accepted poster export, GREEN was:

```text
Focused SEO tests: 23 total, 23 passed, 0 failed
```

The focused suite was run again after the test-only sitemap import cleanup and
remained `23/23`.

## SEO assertions

Seedance 2.5 exact canonical routes:

```text
https://maxvideoai.com/models/seedance-2-5
https://maxvideoai.com/fr/modeles/seedance-2-5
https://maxvideoai.com/es/modelos/seedance-2-5
```

For every locale, tests assert:

- robots `{ index: true, follow: true }`;
- self-canonical URL;
- complete reciprocal `en`, `fr`, `es`, and English `x-default` alternates;
- WebPage, Product, and BreadcrumbList schemas;
- Product Offer with the localized self-canonical as its URL;
- Open Graph image `https://maxvideoai.com/models/seedance-2-5-launch.jpg`
  with declared 1200×630 dimensions;
- Twitter `summary_large_image` projection using the same image;
- localized models-sitemap membership and alternate links.

Seedance 2.0 preservation assertions cover the same three localized URL
shapes for self-canonical, `index,follow`, reciprocal hreflang, sitemap
membership, and English x-default.

The obsolete `seedance-2-5-coming-soon` files remain as historical assets, as
allowed by the brief. No model content, route metadata owner, config, or test
for the public page references them.

## Verification

```text
Focused SEO suite             PASS — 23/23
Frontend lint                 PASS — 0 errors
Public exposure lint          PASS
Complete pnpm test:validate   PASS — 2481/2481, run once
Image format/dimensions       PASS — JPEG RGB 1200×630, no alpha
git diff --check              PASS before report; repeated before commit
```

## Self-review

- Confirmed the diff is limited to the three localized Seedance 2.5 content
  documents, the launch JPEG, five focused SEO tests, and this report.
- Confirmed `page.tsx` already selects `localized.seo.image`, so route-owner
  changes would have been redundant.
- Confirmed registry publication already owns indexation and sitemap policy;
  no generated registry projection was edited.
- Confirmed Product Offer pricing remains runtime-derived; no authored numeric
  price was added.
- Confirmed the social card is derived only from the accepted City poster and
  not from the historical coming-soon artwork.

## Concerns

- The standalone sitemap architecture test needs a narrow React 18 `cache`
  identity shim because the broad sitemap facade imports an unrelated
  server-only video-SEO module. Production Next.js behavior is unchanged, and
  the test executes the real `buildModelsSitemapXml` output.
- No deployed/live-browser metadata smoke was performed; this task explicitly
  avoided deployment and the repository-level route/helper/schema/sitemap
  contracts are the verification boundary.
