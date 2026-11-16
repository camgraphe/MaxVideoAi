# Cinematic model pages — autonomous template review, 14 November 2026

The two pilots use an independent editorial renderer based on the selected prototypes and ongoing user review. Overall template approval remains open. The earlier composition that placed a new hero inside the old page assembly was rejected and has been replaced. This candidate is local only: branch `codex/model-pages-cinematic`, implementation `a9dc45350`, visual review fixes `25e5a4c1d`, initial-HTML correction `ec0afe4cb`. No push, main merge or deployment.

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

### Fidelity correction: visible portrait detail

The next user review exposed a distinction missed by the earlier functional check: a working click-to-zoom did not restore the template's **always-visible magnified detail beside the portrait**. The section now includes that detail from the same reviewed image, with Face & hair / Fabric & texture controls. The original-file zoom remains available separately. This restores the portrait composition; it is not a claim that the entire page matches the approved template.

For subsequent sections, use one reference capture, one current capture at the same viewport, a list of visible differences and an interaction check. Track functional acceptance separately from design fidelity. A passing build does not close a visual difference.

| Portrait comparison point | Reference / correction |
| --- | --- |
| Composition | Full portrait on the left; text and a visible enlarged detail on the right. Restored. |
| Initial state | The detail appears without a click and is present in initial HTML. Fixed. |
| Source identity | The crop uses the same reviewed display source, with no new generation or retouch. Original download is unchanged. |
| Typography and palette | Current “Look closer. Stay human.” copy and MaxVideoAI graphite palette retained intentionally. No hero copy changed. |
| Controls | Face / fabric changes the visible crop; the existing original zoom opens and closes with Escape. Tested. |
| Responsive layout | Desktop 1440 × 1000 / 1100 and mobile 390 × 844 inspected. Mobile detail follows the portrait; no horizontal overflow. |

Reference and before/after captures are in the task visualization directory under `model-page-integration/fidelity-review/`. The exact reference is the existing `seedream-55-cinematic-release/index.html#details` prototype. Production build, 14 focused cinematic/architecture tests, exposure lint and localized HTTP checks passed. The known local cookie-policy warning remains. The media is below the fold and lazy; no new loading-performance claim is made.

## Seedream overview review

The user's annotated review identified a continuous white band between the hero and the first editing proof, with an overly technical introduction. This correction is scoped to Seedream's overview in EN/FR/ES; Flash retains its existing overview.

The chosen proposal is a compact graphite interlude: a two-line editorial heading, a short MaxVideoAI introduction and four links to the existing proof sections. A slight grey tint would leave much of the same visual continuity; another photograph would require a new, distinct proof or repeat a scene. The graphite treatment instead uses the existing brand palette and makes the transition to the white demonstration section explicit. No new media or paid mockup was needed for this contained layout change.

Sources rechecked on 14 November: [ByteDance model page](https://seed.bytedance.com/en/seedream5_5), [official release article](https://seed.bytedance.com/en/blog/more-realistic-images-more-stable-editing-across-100-rounds-introducing-seedream-5-5), and [Higgsfield's model guide](https://higgsfield.ai/blog/seedream-5-5-higgsfield). They support the selected emphasis on iterative editing, realism, text rendering and native transparency. The overview links those capabilities to MaxVideoAI's actual selected examples. It does not turn the provider's 100-edit evaluation into a MaxVideoAI guarantee. Provider attribution remains a discreet official-source link; technical facts remain in the existing specifications and prompt guide.

`ModelCinematicOverview` owns the optional presentation. The localized content defines the four benefits, and the data builder rejects missing, duplicate or non-example destinations. The hero's exact prompt and settings stay in the overview footer. No image source, hero preload, pricing logic or schema builder changes.

Visual comparison points: graphite versus white section boundary; clear heading versus one large paragraph; four benefits versus the old specs strip; direct proof navigation; original prompt and provider attribution retained; two-column mobile benefit layout. The requested change intentionally replaces the old overview's copy and composition while preserving hero and navigation copy. The result is a proposal for continued user review, not a claim of final template approval. Before/after captures are in `model-page-integration/overview-review/` in the task visualization directory.

Validation: production build (TypeScript, lint and prebuild gates), 38 focused tests, exposure lint and six localized HTTP checks passed. Browser comparison used the annotated viewport, 1161 × 998, and mobile 390 × 844; French and Spanish also had no horizontal document overflow at 320 px. Every benefit link reached its intended proof, and the original hero prompt disclosure opened correctly. The band measured 460 px high versus 458 px previously at the annotated width, preserving the first demonstration's arrival while changing the visual hierarchy. The hero/media loading policy is unchanged; no performance or search-ranking improvement is claimed. The work remains local.

## Visual inventory: one purpose per image

| Page | Placement | Dedicated visuals |
| --- | --- | --- |
| Seedream 5.5 | Hero | `first-light` |
| Seedream 5.5 | Successive edit proof | `backstage-original` → `backstage-wardrobe` → `backstage-light` |
| Seedream 5.5 | Text inside a scene | `one-night-only` |
| Seedream 5.5 | Skin, fabric and portrait detail | `after-the-race` |
| Seedream 5.5 | Verified transparent PNG | `free-to-move` |
| Seedream 5.5 | Prompt guide | `55-make-your-move` |
| Seedream 5.5 | Settings and pricing | `55-last-train` |
| Seedance 2.5 Flash | Hero | `midnight-run` |
| Seedance 2.5 Flash | Performance | `after-the-beat` |
| Seedance 2.5 Flash | Prompt guide and dialogue | `the-blue-hour` |
| Seedance 2.5 Flash | Settings and pricing | `where-gravity-ends` |
| Seedance 2.5 Flash | Vertical fashion and action | `make-an-entrance`, `before-the-drop` |

There are nine unique Seedream images and six unique Flash start frames. The comparator intentionally reuses the wardrobe result as the next edit's source; it does not repeat that scene in another section. The portrait detail deliberately reuses that portrait inside its own inspection section, as in the selected template. The prompt guide and settings each have a dedicated image, moved from the former standalone gallery panels. Logos and navigation icons are not demonstration visuals. Existing approved assets cover every placement; no additional paid generation was launched for this integration.

### Coherence pass: media, prompts and useful pricing

Every creative and decision section now has its own visual proof. The exact-locale cinematic panel contract requires one single-image `prompting` placement and one `details` placement; the same uniqueness validation covers them and the remaining examples. This keeps the fifteen-scene inventory intact without duplicate photography. The utility FAQ, related links and final CTA are deliberately compact instead of adding decorative filler.

Prompt guidance is paired with the actual scene. The Flash diner combines intention, camera and sound, with a copyable planned animation brief and a small contextual Milo alternative. Milo's workspace entry is built in the data layer using the shared marketing entry helper. The original image prompt remains available separately and retains its English attribution.

The settings section pairs a unique scene with specifications and one pricing summary. Flash shows eight essential rows, with remaining technical rows in a native disclosure; all rows remain in server HTML. The desktop image stays beside the settings as the visitor scrolls. Three empty “Live quote” cards are replaced by one useful Create entry. Available exact quoted scenarios and current offers retain their original amounts, units and notes. No price calculation, provider routing or schema ownership changed. FAQ and comparison links share a compact two-column section, followed by an inline closing CTA.

Current-pass screenshots are recorded under `model-page-integration/coherence-review/` in the task visualization directory. Production build (including TypeScript, lint and prebuild gates), **37 focused tests**, exposure lint and diff checks passed. `verify-coherence-http.mjs` verifies all six localized routes, canonical/hreflang, parseable schemas, distinct prompt/settings scenes, native image-page details, correct Milo entries, retained Flash technical rows, compatibility redirects and the model sitemap. Its result is `coherence-http-results.json` alongside the verifier.

The compiled candidate was inspected at desktop 1440 × 1000 and mobile 390 × 844, with no document overflow at 320 px on either page. The on-image slider changed with keyboard input; portrait face/fabric selection, original zoom and Escape, composition background selection, Modify/Extend entries, technical disclosures and the video-prompt copy confirmation were exercised. Production console history contained the existing database-dependent cookie-policy warning, with no new production error observed. Earlier development-only popover-property warnings belong to the existing shared popover implementation. No authenticated generation or live tariff verification was possible without the application database. The hero media policy is unchanged and no new CWV gain is claimed.

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


## Enriched hero and shared header/footer

The opening now combines the model title, promise, introduction, visual and useful benefits in one hero, followed by the proof chapter. Seedream uses the new reviewed mountain scene and a fabric crop; the harbour opening is retired. Flash keeps its attributed start frame, with the introduction and four facts over it. The native MaxVideoAI header is opaque and the footer keeps its shared identity. See [implementation and validation](evidence/20261114-model-pages/overview-real-image-notes.md). This remains a local design candidate for review.

### Hero controls and transition refinement

- Replaced hand-drawn benefit marks with four unchanged official Phosphor Duotone SVGs. Regular Phosphor arrow shared by the cinematic CTAs; pinned upstream revision and MIT license are vendored beside the component. No new icon package or runtime media request.
- CTA remains graphite with a silver action disc, but uses the site's rectangular shape with an 8px corner radius. Removed repeated arrows from benefit cards.
- Moved the hero prompt/settings disclosure next to its image caption. Original image, full prompt, copy action and constructor source remain accessible; no provenance strip interrupts the transition after navigation.
- Removed the repeated examples overline from the editorial-only flow and chapter numbers. Proof titles are H2s; the examples region keeps its accessible name. Runtime video galleries retain their section title.
- At 390px, navigation-to-first-title spacing changed from 237px to 57px; navigation-to-comparator spacing from 457px to 271px. Both pilots were checked at 320px without horizontal overflow.
- Validation: 16 focused render/style tests passed; frontend lint has 0 errors and 7 existing unrelated warnings; exposure check and diff check passed. HTTP checks passed for all six EN/FR/ES pilot pages, canonical/hreflang/schema, redirects and model sitemap. Local dev preview only; no deployment.

### Prompt panel and quiet hero follow-up

- Removed prompt and original-image actions from both heroes. Seedream's detail is now a non-interactive crop of the hair, with a localized label; the caption is authored on two lines. Hero imagery, preload and immutable source URLs are unchanged.
- Replaced all cinematic prompt accordions with a native modal side panel (full viewport on mobile): title, setting chips, original prompt text, copy action and source links. Prompt content remains in the initial HTML; opening does not alter the underlying proof or page height. Native modal behavior supplies focus containment, Escape and return to the trigger; document scrolling is restored on close/unmount.
- Hero provenance remains accessible from About these examples. The edit-method note moved into the corresponding prompt panel. Edit chapter bottom spacing is 44px desktop / 28px mobile.
- Comparison defaults to the wardrobe edit at 50%; changing the selected edit resets the slider to 50%. Verified with a real pointer drag from 50% to 26%, then switching to the lighting edit.
- Browser checks: exact copy of the 780-character lettering prompt; Escape returns focus to its trigger and restores scrolling; the lettering section and document heights stay unchanged on open. Mobile dialog is 390px wide with no horizontal overflow and its footer remains at the viewport bottom.
- Focused tests: 16 passed. Six localized HTTP/SEO checks passed, including SSR prompt content and no hero disclosure; canonical, hreflang, structured data, redirects and sitemap remain valid. This is a local preview iteration, not a deployment.

- Final keyboard check: the shared modal tab policy keeps Shift+Tab from Close on the last original link, then Tab returns to Close; Escape closes and restores scrolling. Flash uses the same panel successfully. Additional 320 × 700 mobile check: dialog and footer fit exactly, without horizontal overflow. TypeScript check passed.

## Compact prompt handoff — 14 November

Prompt panels have **Use this prompt** and **Copy prompt** side by side, followed by the discreet **Refine with Milo** link requested in the final review. A discreet price chip sits beside the model, resolution and file format. The public quote is requested only when the panel opens; unavailable prices are labelled **Price in Create**, never replaced with a historical provider cost. The current Seedream 5.5 public quote returned unavailable during this review. Flash panels quote/reuse their Sunburst start-frame images, not a hypothetical video.

The new trusted editorial-preset resolver restores the selected image model, exact prompt and authored settings. Edits carry the precise previous original image, including the second step's wardrobe-edited reference; transparent images retain PNG and transparent background. The image workspace waits for account-scoped draft hydration, loads the preset lazily, clears consumed intent and preserves edited drafts through sign-in. It never submits a generation.

Verified real clicks from the lettering and wardrobe panels into Create: Seedream 5.5, exact prompt, 16:9, 2K, JPEG, and the wardrobe's original reference loaded. Desktop and 390px mobile panels preserve the page geometry, and Copy works. Focused preset, hydration, pricing and existing cinematic contracts pass. TypeScript, lint (seven existing unrelated warnings), exposure and six localized HTTP/SEO routes pass. No generation or deployment performed.

Milo refinement opens the same editorial preset with `assistant=milo&refine=example`. Its localized welcome asks “What would you like to change?” in the existing assistant input; the prompt stays in the manual editor and in the assistant draft context. No assistant message or generation is sent on entry. The existing manual-tab choice still wins if the visitor switches modes. The local process enables the existing assistant UI flag in its ignored `.env.local` for this review; local account/credit services are unavailable, so only navigation, welcome and draft restoration were verified, not a live assistant response.

## Shared site surfaces and uninterrupted examples — 14 November

Removed the full-width **About these examples** disclosure on both pilots. The hero prompt, dated provenance and official source now remain accessible through the existing prompt panel in Details. Per-image metadata, original links and reference lineage stay with their demonstrations. No extra band separates the visual proofs from the next section.

The image page's light canvas, quiet sections, borders and text now inherit the shared marketing tokens (`surface`, `bg`, `hairline`, `text-primary`, `text-secondary`). The native header uses the site's base background, and the existing native footer retains its own shared surface. Prompt panels use the same shared tokens. Hero imagery, graphite actions and dark cinematic sections remain unchanged. Open cinematic disclosures explicitly keep a transparent background: this prevents the shared light `details[open]` rule from making light text unreadable on dark sections.

Browser verification at 1013 × 998: header and prompt-guide background are RGB 244/242/238; the image canvas and prompt dialog use RGB 255/254/250, with RGB 35/35/35 text. Flash's expanded technical details retain a transparent background and light text. Twelve cinematic contracts, TypeScript, lint (seven unrelated existing warnings), exposure checks and all six localized HTTP/SEO checks pass. Sources and complete original prompts remain in server HTML. No production change.

## Prompt guide and specification-sheet design refinement

The specification proof image now stays in normal document flow; its sticky positioning caused the distracting scroll effect reported during review. The browser reports static positioning. Twelve cinematic contracts and diff validation pass after this small CSS change.

The next composition is specified in `seedream-prompt-specs-brief-20261114.md`: a compact, visual prompt recipe; a Milo invitation inspired by the user's prompt-bar reference but in the site's cream/graphite palette; and an accessible reusable specification table with copy/export actions and an explicit source citation. Existing image-model pages supply the alternative destinations, because the current comparison hub does not publish image-model pairs. Three references were privately imported after explicit user authorization. The user then approved the USD 0.82 Sunburst Max mockup; generation completed. Its direction was used for the implementation below, keeping the reviewed original model images and factual content.


### Implemented prompt guide and reusable specifications — 15 November

The image guide now pairs its unique example with four concise cues (subject/action, framing, lighting/textures, exact text), a clearly labelled shortened explanation, and actions using the full original prompt. Reference roles, previous-result editing and PNG transparency instructions remain accessible under Prompt writing tips. The structured localized content owns this recipe; the rendering component contains no model-specific copy.

Milo is a compact invitation in the site's cream/graphite palette, explicitly located inside Create's prompt editor. Its explanation asks users to review/apply the prompt and see the generation price before generating. The existing Sparkles symbol is retained following the user's clarification. No assistant request or generation is submitted by these entry links.

The semantic specification table and its Markdown, rich HTML and CSV exports share their rows. Existing canonical specs are supplemented from the actual composer input schema (reference count, output count, background choices). Exact ratios are retained; current prices are not frozen into the export. Copy/export includes the localized canonical source link. Image alternatives explain concrete differences in available resolution and image-set workflows, linking to existing model pages rather than invented comparison pages.

Content review checked the ByteDance presentation, BytePlus model guide, Higgsfield model article and Google's AI-features guidance. Multi-turn editing, native transparency, examples, limits, full prompts, source evidence and internal links remain. Competitor-specific counts/prices and unexposed provider features were not copied into MaxVideoAI claims. Removing repeated bullets does not remove their facts: these are in the table. AI visibility/ranking gains remain unmeasured until a controlled production test.

In response to the live review, technical details remain on a light surface, pricing/alternatives occupy a compact graphite band, and the FAQ returns to the site's cream background. The video page uses a contrasting cream pricing/alternatives band against its dark technical section. The redundant final promotional strip is removed from both pages. Prompt-control plus signs are now centered Lucide SVGs; image arrows use the same official Phosphor vector as the other actions. The plus-circle centers match exactly in the browser (0px horizontal/vertical difference).

Validation: 56 focused tests pass, TypeScript passes, frontend lint has zero errors and seven existing unrelated warnings; final touched-component lint and diff checks pass. HTTP checks cover all six localized routes, server-rendered text/tables/prompts, canonical/hreflang/JSON-LD, redirects and model sitemap. The checker assembles React's delayed HTML segments without running scripts. Browser verification confirms eight primary video rows plus eight secondary rows and hero evidence inside Details. Seedream has no horizontal overflow at 1113, 390 and 320px; Seedance has no overflow at 1081 and 390px. Copy table produces Markdown including the source link. CSV serialization is tested; its download event requests the correct filename and 533-byte file, but the embedded browser cancels the transfer, so completed file download remains to be checked in a standard browser. No new media generation or production deployment.
