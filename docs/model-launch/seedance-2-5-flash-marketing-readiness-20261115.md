# Seedance 2.5 Flash marketing readiness — 15 November 2026

This audit covers the `codex/seedance-25-flash` candidate, synchronized with
`main` through `3d49f113f`. The separate model-page
design task owns the final visual assembly and editorial renders. No production
publication, tariff activation or paid render was performed during this audit.

The gallery scope is limited to adding Flash to the existing Seedance family and
its existing publication, curation and linking flows. Examples route components,
gallery styles, readers and layout remain unchanged from `main`. The canonical
family URLs and previous model/video identities are preserved. Flash's localized
model-page quick links include the Seedance family gallery, including before the
first Flash video is published. This work does not redesign the Examples pages.
This link-only follow-up passed 42 family/navigation tests and 25 model-content
tests. Browser checks verified reciprocal links in the rendered model, family
and VS pages in all three locales (nine pages), with an empty local gallery.
The full build recorded below predates this localized link addition.

## Discovery and content

| Surface | Verified candidate behavior |
| --- | --- |
| Six VS pages, EN/FR/ES | Standard 2.5, 2.0 Fast, Kling 4 Flash, Veo 3.1 Fast, LTX 2.5 Fast and MiniMax H3. Complete editorial content, scores, related comparisons and direct links to the model, current pricing, Best-for and Seedance examples. |
| Eight Best-for pages, EN/FR/ES | Fast drafts, image-to-video, character references, reference-to-video, multi-shot, ads, UGC ads and product videos include Flash with its supported workflow. Existing editorial picks retain their order. |
| Scoreboard and specifications | All eleven notes are present, with an overall estimate of approximately 8.0/10. The existing short estimate explanation and methodology link remain. Specifications now include MP4/MOV and audio-only references. |
| Benchmark dossier | Eight completed technical canaries are recorded separately from zero quality-scored samples. The numerical editorial estimates are unchanged; API qualification does not establish comparative visual quality or production latency. |
| Examples and navigation | The family label is `Seedance`, with canonical family URLs preserved. Localized descriptions match the qualified audio-reference and output-format behavior. Standard clips retain their own model identity. |
| Model/pricing/PAYG/home/assistant discovery | Flash is discoverable through the shared registry and curated links. Public pricing reads canonical current quotes; absent active tariffs produce unavailable prices. Milo guidance matches the qualified capabilities. |
| SEO | Canonicals, hreflang, indexability, JSON-LD, localized slugs and sitemap discovery pass on the rendered candidate. No launch countdown or new noindex stage was introduced. |

## Where the final videos belong

Use the existing admin publication and curation flows. Retain each render's exact
`seedance-2-5-flash` identity, prompt, settings, original, poster and portable
references. Independent marketing copies, when enabled, use
`/admin/marketing-media`; its existing permission, copy-readiness and visibility
checks still apply. Publication and curation do not generate another video or
reprice its historical receipt.

| Collection or placement | Consumer |
| --- | --- |
| `examples-seedance-2-5-flash` | Flash model gallery and the Flash side of the six VS galleries. Admin's existing missing-model-collection helper recognizes this exact slug. VS currently select up to three eligible public clips from this collection. |
| `family-seedance` | Seedance family gallery. When no managed family selection exists, existing fallback can draw from the model collections. An already curated family selection needs an explicit editorial placement. |
| `examples` | Main examples gallery. Review its own placement and curation instead of assuming a model collection populates every public gallery. |
| Home / PAYG / authored model demonstrations | Review the specific selected source and owning placement. Adding a gallery video alone does not replace these authored demonstrations. |

The canonical family paths are `/examples/seedance`, `/fr/galerie/seedance` and
`/es/galeria/seedance`. Once a genuine public Flash example exists, its version
discovery can link to that actual watch page. Do not use a standard 2.5 clip or an
illustration as Flash output evidence.

Before publishing the selected media, review poster and playback, prompt/settings
reuse and public HEAD/Range behavior. Preserve original downloads and prepare
display derivatives through the existing media workflow. The launch-assets
checker covers its configured waves; it does not, by itself, certify Flash's
pending editorial videos.

## Verification on this candidate

- Full build passed after synchronization: **1,039 generated pages**, including the registry, machine-SEO
  and public-media prebuild checks. Seven existing build warnings remain.
- **72 rendered routes** passed in EN/FR/ES: model, six VS, eight Best-for, examples
  hub/family, comparison/Best hubs, benchmark, pricing, models hub, PAYG and home.
  Responses, canonical URLs, hreflang, indexability and JSON-LD were checked.
- **33 unique primary comparison-link destinations** returned 200 directly.
  Model and three locale sitemaps include Flash and its six comparisons. French
  and Spanish compatibility model URLs redirect to their localized canonical
  path while preserving an allowed tracking parameter.
- A disposable PG17 fixture exercised three public Flash clips, one private Flash
  clip and one public standard clip. Model and VS galleries retained exact-model
  attribution; family discovery included both versions; private media was
  excluded. Watch/detail/recreation data retained Flash identity and removed
  private owner bindings.
- A synthetic historical price of **$999.99** was not displayed as a current
  gallery price. The public quote endpoint returned unavailable without an
  activated Flash tariff, rather than substituting a static amount.
- Mobile gallery opening and actual reader playback succeeded using the existing
  local 4-second Flash canary as test media: **854×480**, **4.041667 seconds**, with
  playback time advancing. Mobile comparison/gallery had no page overflow and
  no browser exceptions were observed. Fixture posters and placements are not
  final editorial assets or production HTTP-readiness evidence.
- **78 focused tests** passed: Flash discovery/benchmark/marketing, localized
  comparison links, family/version journeys, navigation, SEO links, gallery
  attribution/curation and MCP guidance.
- **25 disposable-PG17 tests** passed: catalog pagination, admin curation,
  independent marketing publication, canonical price propagation and all
  **6,804** native Seedance tariff classes. This complete selection was rerun
  successfully after synchronization, as were the 72 routes and delivery checks.
- All eleven conflicts with `main` were resolved. Flash remains in the active
  catalogs while Pika's retirement and frozen historical pricing replay are
  preserved. **381 tests** covering the affected catalog, tariff, public-pricing
  and Studio contracts passed.
- The final full fast run recorded **11,404 passes, one skip and two failures**.
  One is the unchanged fifteen-record GitHub proof freshness gate described
  below. The other was an architecture test scanning a temporary `.next` folder
  concurrently removed by the build; all **three** tests in that file passed
  when rerun after the build completed. The proof freshness gate remains open;
  the complete fast lane is not claimed green.
- Frontend lint, public-exposure checks, configured launch-asset projections and
  `git diff --check` passed.

Local artifacts are under
`.local/seedance-25-flash/marketing-qa-20261115/`: `routes.json`, `delivery.json`,
build/test logs and screenshots. The fixture server and database were stopped
after verification. These checks establish local candidate behavior, not a live
production customer transaction or field Core Web Vitals.

## Remaining release work

1. Finish the separate model-page design and reviewed Flash videos, then apply
   the exact placements above and verify the final public sources.
2. Refresh the production pricing snapshot and activate the prepared Flash ×1.6
   and standard 2.5 ×2 grids through the existing admin workflow. Complete all
   native batch receipts/cache refreshes and verify displayed current prices.
3. Keep the final combined design/integration candidate current with `main` and
   pass required Quality CI. The full fast run's unrelated GitHub marketing-proof
   freshness failure still needs its normal evidence review; this audit does not
   advance those proof dates or claim that gate passed.
4. Follow the repository delivery policy and verify both production domains after
   the authorized release.
