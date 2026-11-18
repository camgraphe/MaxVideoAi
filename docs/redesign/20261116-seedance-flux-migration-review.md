# Seedance 2.5 / FLUX 3 Max — cinematic migration review

Date: 2026-11-16. Candidate branch: `codex/model-pages-seedance-flux`.
This is a review PR, not production publication.

## Scope and positioning

Seedance 2.5 standard and FLUX 3 Max reuse the cinematic presentation developed for
Seedream 5.5 and Seedance 2.5 Flash. No other model opts in. Model publication,
providers, pricing matrices, sitemap identity, redirects and authenticated generation
behavior remain unchanged.

- **Seedance 2.5:** text/image/multimodal creation, optional audio and up to 1080p.
  A dedicated native Draft section shows the actual Create control, explains the
  480p preview → separately quoted 1080p final, and distinguishes this workflow
  from a normal 480p generation and from Flash. Modify/Extend remain documented,
  without borrowing Flash films as proof of standard-model results.
- **FLUX 3 Max:** text, image, first/last frame and timed keyframes, 5–20 seconds.
  The actual Create timeline accompanies the existing validated public keyframe
  demonstration. Frame indices, images, prompt and reuse settings are retained.
  The page distinguishes Max from FLUX 3 (including the absence of Extend in Max)
  and describes 1080p as upscaling, rather than native output.
- Real public model-owned films replace generic imagery. No new paid generation,
  private-account publication or media-library mutation was performed.

## Search and citation preservation

See [OUTREACH evidence and priorities](20261116-seedance-flux-outreach-audit.md).
The audit is bounded by the available exports; Seedance's query data is not an
exact-URL query report, and cannibalization was not demonstrated by those exports.

All six EN/FR/ES pages retain the live title, description, canonical and hreflang
set (compared with production HTML captured before this change). Existing FAQ,
technical details, pricing scenarios, Seedance 2.0 comparison and FLUX 3 comparison
remain. The four original FLUX film prompts and three Seedance prompt templates are
preserved; prompt drawers add Copy, reuse and Milo where a public recipe exists.
The obsolete Seedance FAQ claiming its hero lasts 24 seconds was corrected.

Added citations explain Draft and keyframes next to their features. A verified link
to `/benchmarks#review-flux-3-max` keeps the editorial scoring methodology accessible.
A standard/Flash comparison link makes family choice explicit. Specs retain their
semantic HTML table and include the model, canonical source and checked date in
copy/CSV exports. These improve clarity and reuse; they do not guarantee citations,
backlinks or ranking gains.

## Verification

- Six localized routes return HTTP 200. One H1 each, no broken local section anchors,
  no missing images, no horizontal overflow at desktop or 390px mobile.
- Headless Chromium review: no page JavaScript errors; prompt drawer opens and closes
  with Escape; reuse targets the exact model/public job and retains language.
- 93 unique non-workspace/non-media destinations extracted from the six pages return
  HTTP 200, including watch, examples, comparison, pricing and provider references.
- Gallery rails retain 11 Seedance and 13 FLUX cards in the captured local public
  snapshot after excluding dedicated proofs. Production playlist membership still
  comes from the existing public reader, not this snapshot.
- No MP4 requests on initial load in either new page. Manual players retain
  `preload="none"`, server-rendered posters and fixed geometry.
- First Play succeeds for both Create films (Seedance 1280×720, FLUX 1280×704);
  CSV downloads succeed for both models.
- Immutable hero AVIFs: Seedance ~8KB mobile / 18KB maximum; FLUX ~6KB mobile / 14KB
  maximum. The actual control previews use responsive desktop/mobile captures.
- A final 40-test targeted rerun also passes after the last compatibility edits.
- 113 focused migration/template/content/media/export tests and 85 additional
  SEO, pricing, loading and view-model tests pass. TypeScript passes. ESLint has no
  errors (seven existing warnings in unrelated workspace/billing files).
- Public exposure, registry projections and launch-asset checks pass.

The local server intentionally has no database. It therefore cannot issue a live
customer quote and correctly omits Product/Offer JSON-LD when no public offer is
available. The shared commercial/schema builders are unchanged and their pricing
contracts pass; verify the live offer on the authenticated PR environment before
merge. Do not replace unavailable customer pricing with historical/provider costs.

No comparable production CWV or post-migration GSC outcome is claimed from a local
development review. Before merging, review the PR deployment at desktop/mobile,
verify live offers, run the required Quality CI and reconcile current main. Monitor
these exact URLs and their family pages after rollout using the same GSC windows.
