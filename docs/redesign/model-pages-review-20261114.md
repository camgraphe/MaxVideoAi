# Cinematic model pages — autonomous template review, 14 November 2026

The two pilots now use an independent editorial renderer matching the approved prototypes. The earlier composition that placed a new hero inside the old page assembly was rejected and has been replaced. This candidate is local only: branch `codex/model-pages-cinematic`, implementation `a9dc45350`, visual review fixes `25e5a4c1d`, initial-HTML correction `ec0afe4cb`. No push, main merge or deployment.

The integrated model-owner commits are Seedream `372a77053` and Seedance Flash `dffa9296c` (local merge `27f2ee100`). The shared Desktop checkout and both owner branches were not edited.

## Review URLs

- [Seedream 5.5](http://localhost:3116/models/seedream-5-5)
- [Seedance 2.5 Flash](http://localhost:3116/models/seedance-2-5-flash)
- French uses `/fr/modeles/`; Spanish uses `/es/modelos/`, with the same model slugs.

Creative screenshots are English. Content remains exact-locale EN/FR/ES. Only the two pilots opt in; older model pages retain their existing renderer.

## Follow-up after visual review

The current local revision restores the on-image edit slider and three edit thumbnails, adds an on-demand 2× portrait inspection with keyboard and mobile controls, and adds a third composition background. The hero is shorter and higher, the provider byline becomes “On MaxVideoAI”, and the scrollbar is thin and scoped to these two pages. Specifications, pricing, FAQ and closing sections have tighter geometry. Provider attribution remains in the model explanation, source disclosures and established metadata.

Flash now has Frame / Planned motion / Planned sound controls with copyable video briefs, plus Create / Extend / Modify panels. The exact entry modes are `t2v`, `extend` and `v2v`. All three workflow descriptions remain in server HTML. Existing stills remain attributed Sunburst start frames; replacing them with verified Flash videos is release work.

Milo is only a compact alternative inside the prompt guide. The previous large promotional block and its incorrect Studio screenshot were removed after user review. The link opens the composer assistant for the selected model and language: `/app/image?engine=seedream-5-5&assistant=milo&lang=en` or `/app?engine=seedance-2-5-flash&mode=t2v&assistant=milo&lang=en`. It does not submit a message, preload a prompt or start generation. Image prompt examples are copyable text, because the image workspace does not support URL prompt hydration. These entry contracts were confirmed with both integration owners.

The rebuilt production candidate passes prebuild gates, TypeScript and lint (existing unrelated lint warnings remain). The cinematic suite passes **9/9** after the Milo correction. All six localized pilot routes return 200 with one H1, canonical, four hreflang entries and parseable JSON-LD; the assistant appears inside `#prompting` and points to the correct model, locale and workspace. Desktop 1440 × 900 and mobile 390 × 844 were reviewed; the prior 320 × 740 pass found no overflow. Slider keyboard input, the portrait zoom, composition backgrounds, workflow modes, planned sound and prompt copying were exercised. The local environment still produces the known database-dependent cookie-policy warning and cannot validate authenticated generation or live prices.

Review screenshots are under `model-page-integration/iteration-two/` in the task's visualization directory. The current Milo evidence is `seedream-prompt-assistant.png`, `seedream-prompt-assistant-mobile.png` and `flash-prompt-assistant.png`; the earlier `seedream-milo*` screenshots are rejected designs. HTTP evidence for this correction is `/private/tmp/cinematic-iteration-three-http.json`.

The loading measurements below describe the earlier autonomous renderer, before this follow-up; they are not new measurements of these interactions. This pass confirmed one initial hero request and deferred original portrait loading, but makes no new CWV claim. Nothing has been pushed or deployed.

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

## Composition and ownership

`ModelCinematicPage` owns its full-bleed hero, section navigation, overview, demonstrations, prompt guide, specifications, pricing, FAQ and related-model composition. It does not render `ModelPageContentSections` or the old pricing/spec/FAQ cards. The route still shares the existing capability projection, exact commercial promises, registry, localized content and schema builders. `ModelExamplesSection` is identical to the clean Seedream owner baseline.

The image page uses the approved harbour photograph, large model name and two graphite actions at the bottom left. The video variant has a distinct dark composition. On mobile it places the title above the landscape car scene, retaining both driver and vehicle. It does not reuse the image page's portrait crop. The shared header's adaptation is scoped to `:has(.model-cinematic-page)`; independent browser comparison found zero measured style/geometry differences on Seedream Pro after client navigation.

The Examples opening is a small orientation label followed by the demonstration. The first edit image starts around 464 px after exploration on a 1440 × 1000 viewport, compared with 773 px before review. Introductory provenance is preserved in a native disclosure after the demonstrations. Prompts remain under their actual images. No photograph is duplicated merely to fill a section.

Image details retain the existing non-streaming behavior: specifications, prices and FAQ must be directly visible in the initial HTML without a `[hidden]` stream container. Video details preserve the existing single streaming boundary, avoiding unstable separate pricing slots. Canonical, hreflang, metadata, current-price schemas and original-source identity remain with their established owners.

## Reviewed hero delivery

The reviewed `model-cinematic-hero-displays.json` profile supplies immutable AVIFs and the existing WebP fallback. Exact original hashes are verified before preparation; originals are not overwritten. Seedream uses a mobile portrait crop; Flash uses a mobile landscape derivative for its distinct composition. The desktop Seedream selection is 27,731 bytes rather than the previous 67,244-byte optimized WebP.

The two media-qualified preload links match the picture sources. Chrome requests one hero only; no competing WebP or full original request was observed. The global Next image optimizer remains unchanged. The profile can be checked with `node frontend/scripts/prepare-cinematic-hero-images.mjs`.

## Validation and independent review

- Production build, TypeScript, lint and required prebuild checks passed; existing lint warnings remain outside these changes.
- Autonomous renderer/media/layout/examples/streaming verification: **44 passed**. Subsequent visual fixes: **18 passed**. Image initial-HTML correction: **28 passed**. Final metadata, locale, schema, visible offer, sitemap and editorial-media checks: **34 passed**. These overlapping runs are not a combined count.
- `lint:exposure`, immutable media validation and `git diff --check` passed.
- The original integration's financial/provider checks remain applicable: two disposable PostgreSQL integration tests passed; the image owner independently validated 82 tests and the video owner verified 27,071 unchanged historical collector points/offers. No financial/provider code changed during the visual correction.
- Independent visual review closed all three findings on `25e5a4c1d`: direct Examples entry, complete mobile video scene, language-icon contrast. It confirmed the actual edit-source chain, keyboard slider, alpha identity, prompt/original links, no observed console error and unchanged Pro page after navigation. Desktop 1440 × 1000, mobile 390 × 844, and Flash 320 × 740 were examined.
- Final HTTP checks cover all six routes, one H1, canonical, EN/FR/ES/x-default hreflang, native JSON-LD, meaningful anchors, current-model actions, absence of repeated example URLs, image-only provenance and original links. Seedream details are explicitly checked for initial visibility in all three locales. The actual `/sitemap-models.xml` includes all six URLs; compatibility redirects remain intact. See `evidence/20261114-model-pages/autonomous-http-results.json` and the runnable verifier alongside it.

## Comparable loading evidence

The final candidate and clean baseline `372a77053` are independently compiled production servers, using identical public auth configuration and no application database. Chrome measurements use 150 ms latency, 200,000 B/s download, 93,750 B/s upload, CPU ×4, DPR 1, disabled browser cache and an 8-second observation window. Three alternating runs per viewport; these are laboratory observations, not field CWV or INP measurements.

| Seedream median | Baseline | Final autonomous renderer |
| --- | ---: | ---: |
| Desktop 1440 × 1000 LCP | 1,032 ms | 996 ms |
| Mobile 390 × 844 LCP | 1,028 ms | 928 ms |
| Desktop CLS | 0.00036 | 0.00036 |
| Mobile CLS | 0.00039 | 0.00039 |
| HTML transfer | 87,310 bytes | 60,576 bytes |

The first rejected iteration's desktop regression is documented in `evidence/20261114-model-pages/first-iteration-review.md`. Its old screenshots and measurements are not the final design. The new composition removes that regression while preserving the prominent photograph and readable source content. The final Flash mobile smoke test measured 996 ms LCP with one 8,851-byte AVIF and no overflow; it is not a comparative Flash benchmark. Aggregate transfer totals include ancillary browser requests and are retained in the raw record, not used as a clean savings claim. Raw final samples are in `evidence/20261114-model-pages/autonomous-loading-samples.json`.

## Search intent and rollout boundaries

The GSC and Bing evidence, query/page distinctions and source windows remain in `model-pages-search-evidence-20261114.md`. The redesign preserves stable destinations, readable model facts, prompt examples, exact references, source links, technical details and comparison links. It creates a clearer visual demonstration; it does not establish a ranking, traffic, citation or conversion increase before a controlled live test.

Review remains local. The environment has no application database, so prices truthfully fall back to the current-quote state and no fabricated Offer is emitted. The database-dependent full sitemap and historical Seedance playlist fail identically on the clean baseline; the model sitemap and the six pilot routes work. Actual Flash videos, effective model access, price activation, current-main integration and required Quality CI remain release work with the model owners. No countdown or automatic paid generation was added.
