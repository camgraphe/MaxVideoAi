# Cinematic model pages — local review, 14 November 2026

The review candidate combines the two model integrations with an opt-in cinematic presentation. It has not been pushed, merged to main or deployed. The existing image/video workspaces, canonical quote engine, model registry, metadata and localized editorial owners remain authoritative.

Branch: `codex/model-pages-cinematic`. Dependency commits: Seedream `372a77053`, Seedance Flash `dffa9296c`. Local integration merge: `27f2ee100`. The shared Desktop checkout and the two model-owner branches were not edited.

## Review URLs

- English: `http://localhost:3116/models/seedream-5-5` and `http://localhost:3116/models/seedance-2-5-flash`.
- French: `/fr/modeles/seedream-5-5` and `/fr/modeles/seedance-2-5-flash` on the same server.
- Spanish: `/es/modelos/seedream-5-5` and `/es/modelos/seedance-2-5-flash` on the same server.

Creative review screenshots are English. The real page content is localized independently in EN/FR/ES; missing cinematic content never falls back to English.

## Visual inventory: one purpose per image

| Page | Placement | Dedicated visuals |
| --- | --- | --- |
| Seedream 5.5 | Hero | `first-light` |
| Seedream 5.5 | Successive edit proof | `backstage-original` → `backstage-wardrobe` → `backstage-light` |
| Seedream 5.5 | Text inside a scene | `one-night-only` |
| Seedream 5.5 | Skin, fabric and portrait detail | `after-the-race` |
| Seedream 5.5 | Verified transparent PNG | `free-to-move` |
| Seedream 5.5 | Campaign and story examples | `55-make-your-move`, `55-last-train` |
| Seedance 2.5 Flash | Hero | `midnight-run` |
| Seedance 2.5 Flash | Performance and dialogue | `after-the-beat`, `the-blue-hour` |
| Seedance 2.5 Flash | Fictional environment | `where-gravity-ends` |
| Seedance 2.5 Flash | Vertical fashion and action | `make-an-entrance`, `before-the-drop` |

There are nine unique Seedream images and six unique Flash start frames. The comparator intentionally reuses the wardrobe result as the next edit's source; it does not repeat that scene in another section. The existing Prompt Lab is text-only: its two source results appear once in the campaign/story panel, with matching exact prompts. Logos and navigation icons are not demonstration visuals. Existing approved assets cover every placement; no additional paid generation was launched for this integration.

Seedream media are real Seedream outputs. Exact edit-source hashes, prompts, formats, resolution and original-file links are available. The transparent original PNG and its immutable display WebP both contain a verified non-opaque alpha channel. The preview background toggle changes only the viewer background.

Flash media are GPT Image 2.6 Sunburst stills, explicitly attributed as animation start frames. Motion and sound text describes planned shots. There is no fake play button, borrowed Flash video or VideoObject for these images. Actual reviewed videos can enter through the existing video gallery owner later.

## Ownership and integration review

- Opt-in page presentation lives in the exact-locale `cinematic` block. Examples copy, panel assignments and shot plans remain under `examples.cinematic`; Prompt Lab remains under `prompting`.
- The route remains an orchestrator. Route-local components own hero, assets and examples; only comparison, alpha preview and the existing copy button need browser state.
- The sole image evidence manifest is extended with real PNG/reference lineage. Flash start frames have a separate image-only manifest with `videoUrl: null`.
- The hero uses one priority responsive display image. Other media are lazy with fixed geometry; original-file and schema URLs retain the original source. No production library or provider credentials are needed for this review.
- The primary controls use dark graphite, including hover; no orange or bright white hero control. Style scope ends with the two opted-in pages and was checked through client navigation to Seedream 5.0 Pro.
- Both model owners independently reviewed `27f2ee100`: catalogue identities and both mandatory active-tariff guards are preserved. The Seedream tariff file is byte-identical to its owning branch. Flash runtime, commercial pricing, model content outside the new presentation, benchmark evidence and publication decisions are preserved.

## Validation

- Production Next.js build completed; its type/lint and registry/media/SEO prebuild checks passed. Seven existing lint warnings remain outside the cinematic changes.
- Final focused model/page/media tests: **61 passed**. After the hero-priority adjustment, cinematic, examples-boundary and sitemap tests: **18 passed**.
- Final original/schema/streaming checks: **41 passed**. After adding the two text-only Prompt Lab results to the visible gallery, visual coverage and localized Examples contracts: **15 passed**. These overlapping checks are reported separately.
- Disposable PostgreSQL 17: **2 integration tests passed**, covering new Seedream web/MCP/public quotes and the Seedance LAS tariff release. No production tariff was activated.
- The two expectation conflicts found in the broad integration test run (projection count and sorted model IDs) were corrected; the affected files passed **32 tests** on recheck.
- The image owner independently ran **82 tests** on an isolated archive of `27f2ee100`, covering App/MCP/Studio prices, provider costs, coverage, public projections, cutover and admin comparison. The video owner independently checked the historical collector: **27,071 unchanged historical points/offers**, with new Seedream identities excluded as intended. These are separate reviews, not a combined suite count.
- `lint:exposure` and `git diff --check` passed.
- All six pilot URLs return 200 with one model H1, exact canonical, EN/FR/ES/x-default hreflang, FAQ and breadcrumb schemas. No still is represented as VideoObject; the environment without a database emits no fabricated Offer. English-prefix and French-segment compatibility redirects work. The actual `/sitemap-models.xml` returns 200 and contains all six localized URLs.
- Browser controls verified: two-step comparison and keyboard range, exact source links, prompt disclosure/copy, alpha preview, FAQ, section navigation, and unchanged styling on an older image page. Desktop and mobile views are captured; responsive overflow is checked at narrow widths.

## Comparable loading evidence

Two independently compiled Next.js servers: clean Seedream integration baseline `372a77053` on port 3117, candidate on 3116. Same public auth configuration, no application database. Chrome: 150 ms simulated latency, 200,000 B/s down, 93,750 B/s up, CPU ×4, DPR 1, disabled browser cache, 8-second observation window. Optimizer warmups are excluded. Three runs per Seedream viewport are compared; these are local laboratory observations, not field Core Web Vitals or an INP assessment.

| Seedream median | Baseline | Complete cinematic page |
| --- | ---: | ---: |
| Mobile 390 × 844 LCP | 1,036 ms | 1,008 ms |
| Mobile CLS | 0.00039 | 0.00039 |
| Mobile bytes transferred in 8 seconds | 534,522 | 542,330 |
| Mobile image bytes | 23,716 | 17,172 |
| Desktop 1440 × 1000 LCP | 1,032 ms | 1,840 ms |
| Desktop CLS | 0.00036 | 0.00036 |
| Desktop bytes transferred in 8 seconds | 512,345 | 577,627 |
| Desktop image bytes | 71,872 | 122,802 |

Mobile timing is effectively stable; its total transfer grows about 1.5% while the page gains visual depth below the fold. No original image is requested on opening. Desktop LCP changes from the old text H1 to the large cinematic image and is reproducibly slower by roughly 0.8 seconds. `fetchPriority="high"` is explicit but does not eliminate that difference. **This desktop regression remains a release gate: do not claim a performance win or approve production on this evidence.** Resolve the image-delivery cost and rerun comparable checks before release; do not shrink away the visual proof merely to change the LCP candidate.

One Flash mobile smoke measurement recorded LCP 1,064 ms / CLS 0.00039, with no original-image request. It is not a before/after Flash comparison. Native link prefetch can vary the resource count; raw samples retain all runs rather than hiding that variability.

Raw measurements and HTTP/viewport results are in `evidence/20261114-model-pages/`. The final `complete-*` loading samples include both campaign/story images; earlier `candidate-*` and `final-*` labels preserve the preceding iterations. The final HTTP document has eight initial Seedream image elements, with the ninth result available through the second comparator step, and six Flash start frames. No demonstration source is repeated across sections.

English desktop/mobile screenshots are stored locally at `/Users/adrienmillot/.codex/visualizations/2026/11/13/01a1d6bb-6426-7122-9da1-18d13b741eef/model-page-integration/` (`seedream-desktop.png`, `seedream-mobile.png`, `seedance-desktop.png`, `seedance-mobile.png`).

## Local environment limits and release gates

The local preview intentionally has no `DATABASE_URL` or provider credentials. Price cards show the canonical unavailable/live-quote state, not provisional retail amounts. Database-backed historical video playlists and the full runtime sitemap cannot be smoke-tested here: Seedance 2.5 returns 500 and `/sitemap.xml` returns 503 on both the clean baseline and candidate. This is reproduced on the unchanged baseline and is not attributed to the redesign. The actual model sitemap and publication contracts do pass; verify the full sitemap and live prices on the approved integrated preview with its intended database before release.

Flash API access, actual Flash video results and production tariff activation remain separate launch qualifications owned by the model task. Keep the start-frame labels until real reviewed results replace them. The launch preparation state in the registry is not proof of successful provider access.

Search evidence and its limitations are recorded in `model-pages-search-evidence-20261114.md`: GSC 10 October–6 November 2026, capped query export, separate query/page tables; Bing citation counts are not visits or sales. No ranking, AI citation or conversion gain is claimed before publication and measurement.
