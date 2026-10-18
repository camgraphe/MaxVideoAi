# Best for: selection review, 19 October 2026

Scope: 29 exact current video model contracts read through MaxVideoAI MCP; twelve editorial shortlists, in English, French and Spanish. The full dated evidence is held in OUTREACH, sources/2026-10-19/best-for-refresh.

## Method

The sequence tells readers where to start testing for a task. It is based on supported workflows, input controls, duration, sound and delivery constraints, with an explicit reason per use case. This is not a measured quality, latency or price ranking. Product editorial guidance is preference, not an independent benchmark. No model inherits another version’s review.

The prior engine-scores.v1.json was dated 2026-09-03 and described its method as manual-v1-internet-calibrated-with-platform-pricing. Best-for no longer reads it, requires its numeric coverage or synthesizes an automatic score fallback. Comparison-page scores are outside this change. Public/current model and catalog eligibility remain mandatory.

## Reviewed choices

| Use case | Suggested order |
|---|---|
| image-to-video | seedance-2-5 → kling-o3-pro → minimax-h3 → flux-3 → luma-ray-3-2 |
| cinematic-realism | seedance-2-5 → wan-3-prime → veo-3-1 → minimax-h3 → luma-ray-3-2 |
| character-reference | seedance-2-5 → kling-o3-pro → minimax-h3 → wan-3-prime → grok-imagine-video-1-5 |
| reference-to-video | seedance-2-5 → minimax-h3 → kling-o3-pro → wan-3-prime → gemini-omni-flash |
| multi-shot-video | seedance-2-5 → kling-o3-pro → wan-3-prime → minimax-h3 → wan-3 |
| 4k-video | kling-o3-4k → minimax-h3 → veo-3-1 → gemini-omni-flash → seedance-2-0 |
| ads | seedance-2-5 → kling-o3-pro → minimax-h3 → wan-3-prime → gemini-omni-flash |
| ugc-ads | minimax-h3 → seedance-2-5 → happy-horse-1-1 → grok-imagine-video-1-5 → veo-3-1 |
| product-videos | seedance-2-5 → kling-o3-pro → wan-3-prime → flux-3 → ltx-2-5-pro |
| lipsync-dialogue | minimax-h3 → veo-3-1 → seedance-2-5 → happy-horse-1-1 → ltx-2-5-pro |
| fast-drafts | ltx-2-5-fast → seedance-2-0-fast → flux-3-draft → veo-3-1-lite → kling-3-turbo-standard |
| stylized-anime | seedance-2-5 → kling-o3-pro → wan-3-prime → luma-ray-3-2 → flux-3 |

## Why models moved

- Kling Omni 4K replaces the generic Kling 3 4K choice at the top of the 4K page because it supports image references as well as text/image input, at 3–15 seconds. H3, Veo 3.1, Omni Flash 1.1 and Seedance 2.0 retain different control/delivery routes.
- H3 opens UGC and dialogue for 5–15 second scenes with sound and mixed references. LTX Pro enters dialogue for a genuinely distinct owned-audio workflow. This does not assert that either wins a lip-sync benchmark.
- The draft page separates movement/audio timing (LTX), mixed references (Seedance Fast), first/last frames (FLUX Draft), short bounded clips (Veo Lite), and 720p generated-sound scenes (Kling Turbo Standard). No measured-speed or cheapest-price claim.
- FLUX 3 and Luma Ray 3.2 enter image/stylized selections for first/last frames, continuation, source transformation or reframing. Ray’s missing audio is explicit. No anime-quality benchmark is claimed.
- Character reference retains its previous five after review; novelty alone is not a reason to change a suitable selection.
- H3 Max remains an alternative, but its name does not imply 4K: its current ceiling is 1080p.
- Pika remains on request. Hailuo 02 offers a narrower silent 512P/768P route. Other current models stay available in the catalog; exclusion from five picks is not a negative quality judgment.

## Public media

Sixteen curated public job references are available to the template; only exact eligible selected models can appear. The renderer rechecks public visibility, indexability, poster and video availability. Up to three scenes are shown. The 4K page additionally requires real original dimensions of at least 3840 × 2160 (either orientation); it currently has one qualifying curated example. Dialogue currently has two spoken scenes. It does not fill these slots with unrelated footage.

These are newly featured existing public renders, not new paid generations or same-prompt tests. Other use cases may show creative output by selected models; the prompts and inputs differ. A missing clip never becomes an image from a sibling model.

## SEO and delivery

Titles, slugs, frontmatter, canonicals and locale ownership remain intact. One English meta description is corrected to the current draft models. All comparisons are existing published/indexable pairs; no new competing landing pages are introduced. ItemList order and descriptions match visible editorial cards, without review scores. FAQ answers are server-rendered and individually expandable; no FAQ rich-result promise.

The initial page renders responsive posters, at most one priority image and no video elements. The original-fidelity shared player is dynamically mounted after an explicit click. Native controls, source fallback, focus management and dismissal use shared owners. Studio and MCP routes are distinct, with separate assistance/media costs disclosed.

## Release gate

Keep this PR in draft for Adrien’s visual review and coordinated delivery. Local dev screenshots and resource inventories are not comparable CWV measurements. Before promotion, compare mobile/desktop cold and warm production-build loading on equivalent data, inspect initial requests and first Play, and check current public clip eligibility. No claim of an LCP, CLS or INP gain is made.

No title A/B test is launched alongside this content refresh. Record the actual deployment timestamp, establish a new observation baseline, then test one snippet variable with query/device/country/position segmentation.
