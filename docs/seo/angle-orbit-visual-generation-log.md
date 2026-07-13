# Angle Orbit visual generation log

Generated and audited on 2026-07-13 for the localized Angle landing page. All six published source photographs were created with the built-in ImageGen tool. All eight published transformed views were produced in the authenticated MaxVideoAI Angle workspace; no transformed view is an ImageGen substitute. The video-preparation pair was replaced after visual review while keeping the human-model use case, and the original cinema-camera hero was later replaced with the approved two-actor dialogue coverage sequence documented below.

## Source generation

The five non-video prompts use this exact common suffix: `landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials`. The replacement video-preparation prompt is recorded in full because it adds explicit pose and identity constraints.

| Section | Full ImageGen prompt | Accepted raw source | Result |
| --- | --- | --- | --- |
| Hero | `compact professional cinema camera in black anodized aluminum with realistic optical glass, fasteners and tactile controls, centered on a sculptural ivory plinth, warm museum-gallery light. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/hero-source.png` | Accepted first generation; complete camera, credible materials, no text or logo. |
| Proof | `burnt-orange portable wireless speaker with woven fabric and machined metal controls, straight-on catalog camera, pale limestone studio. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/proof-source.png` | Accepted first generation; clean front view and readable material texture. |
| Product | `cobalt and off-white technical running shoe on a transparent low stand, straight-on commerce view, warm gray seamless studio. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/product-source.png` | Accepted first generation; complete silhouette and clean sole geometry. |
| Storyboard | `solitary actor in a rust coat standing at the edge of a windswept coastal road, eye-level cinematic frame, overcast natural light. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/story-source.png` | Accepted first generation; clear subject and distinct cinematic setting. |
| Ad creative | `faceted clear fragrance bottle with a deep red glass cap, straight-on campaign frame, saturated burgundy and cream set. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/ad-source.png` | Accepted first generation; centered bottle, credible facets, no label text. |
| Video prep | `Use case: photorealistic-natural; Asset type: premium landing-page source image demonstrating camera-angle generation for fashion models; Primary request: create a convincing editorial first frame of one adult fashion model whose identity, outfit, pose, and environment can remain stable when a camera is rotated around them; Scene/backdrop: quiet minimalist architectural pavilion built from pale limestone, brushed steel, and tall ribbed-glass panels; clean geometric lines; no signage, no other people; Subject: one adult fashion model wearing a sculptural cobalt-blue tailored coat with distinctive ivory piping and matte black ankle boots; upright composed stance, feet planted, torso straight, one hand resting lightly on the coat lapel, other arm relaxed; calm neutral expression; face clearly visible; natural anatomy and realistic skin texture; Style/medium: premium photoreal editorial fashion photography, sophisticated contemporary campaign, physically credible fabric and materials, restrained and timeless rather than flashy; Composition/framing: landscape 4:3; eye-level front three-quarter view at roughly 10 degrees; model fills about 70 percent of the frame; full coat silhouette and nearly full body visible with no cropped hands or feet; enough architectural depth cues around the subject to make a later 45-degree camera rotation obvious; Lighting/mood: soft directional morning light with subtle shadow definition, elegant calm atmosphere, accurate skin tone and fabric texture; Color palette: cobalt blue, warm limestone, brushed silver, soft ivory, matte black; Constraints: a stable static pose suitable for viewpoint transformation; one person only; keep limbs separated and readable; no dance, no walking, no action pose, no twisted torso, no wind-blown clothing, no props, no logos, no text, no watermark, no signage, no duplicate person, no cropped limbs, no exaggerated lens distortion, no surreal geometry` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/video-source-v2.png` | Accepted first replacement generation at 1448 × 1086; stable pose, prominent model, readable asymmetric coat piping, clean architecture, and no text or logo. |

All accepted raw sources are 1448 × 1086 PNG files stored outside `frontend/public` until their genuine Angle derivatives were accepted.

## Authenticated Angle generations

Zoom `1.2` is the actual displayed workspace value for the original accepted results; the replacement video-preparation result uses the explicitly logged `1.5` value. The URLs below are the MaxVideoAI render URLs exposed by the authenticated tool.

| Asset | Engine | Rotation | Tilt | Zoom | Latency | Cost | Render URL | Result status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Hero 45 | FLUX Multiple Angles | 45° | 3° | 1.2 | 7,844 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/23f02af8-3369-4f7f-8982-a09e913bc386.webp` | Accepted: strong three-quarter change, complete camera, credible geometry. |
| Hero 90 | FLUX Multiple Angles | 90° | 2° | 1.2 | 15,844 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/1a252661-565a-46c6-a8ee-a6dbd7fa6f7d.webp` | Accepted: clear profile/rear view and stable identity. |
| Hero elevated (original) | FLUX Multiple Angles | 45° | 18° | 1.2 | 15,214 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/6d700dd5-bfdb-434c-93ec-1f358fea8663.webp` | Rejected by post-commit review: protruding mesh flap, garbled top-body geometry, and pseudo-text lens markings. Removed from the public asset. |
| Proof 45 | FLUX Multiple Angles | 45° | 3° | 1.2 | 21,118 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/9bca5746-9bb1-4c32-ab2c-b2f086bd22a0.webp` | Accepted: meaningful side depth and preserved speaker identity. |
| Product 45 | FLUX Multiple Angles | 45° | 3° | 1.2 | 12,495 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/4041d65c-a6da-45da-8ae2-7fff18f6805c.webp` | Accepted: clear commerce three-quarter and intact shoe geometry. |
| Storyboard elevated (original) | FLUX Multiple Angles | 35° | 15° | 1.2 | 16,240 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/7fad8a0a-d71c-4e07-a767-5ead13aa9d5a.webp` | Rejected by post-commit review: smeared/deformed eye, nose, and cheek caused identity drift. Removed from the public asset. |
| Ad 45 | Qwen Multiple Angles | 45° | 2° | 1.2 | 11,466 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/22995160-c14b-4e71-834a-c1985b235747.webp` | Accepted: visible three-quarter facets and preserved bottle volume. |
| Video prep selected angle | Qwen Multiple Angles | 69° | 3° | 1.5 | 14,230 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/777bbce8-51e1-43ec-978d-c50d93ee1865.webp` | Accepted after original-detail review: unmistakable profile change with stable face, lapel hand, boots, coat silhouette, ivory piping, and architectural identity. Full PNG: `.superpowers/sdd/angle-orbit/task-4-sources/angle/accepted/video-69-v2-qwen.png`. |

The accepted full-resolution outputs are persisted under `.superpowers/sdd/angle-orbit/task-4-sources/angle/accepted/` as PNG files. The generated thumbnail URL was not used as the final public asset; each accepted result was downloaded through the workspace Download control.

## Rejection evidence

New replacement attempts were retained rather than overwritten. The superseded published video pair remains recoverable from git history.

| Attempt | Engine and settings | Render URL | Preserved file | Rejection reason |
| --- | --- | --- | --- | --- |
| Ad 45 attempt 1 | FLUX, 45° / 2° / 1.2; 24,270 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/ceab1508-4dc2-4220-a8ea-35046363ba6a.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/ad-45-attempt-1-weak-viewpoint.png` | Quasi-front framing; viewpoint change was too weak. |
| Ad 45 attempt 2 | FLUX, 45° / 2° / 1.2; 30,277 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/ca65f72f-7208-4d02-9ae5-cd095214127b.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/ad-45-attempt-2-weak-viewpoint.png` | Second quasi-front result; still insufficient viewpoint change. |
| Workspace preview attempt 1 | FLUX, 45° / 3° / 1.2; 23,227 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/506f5e43-1d86-4438-93c9-44d9e415c46e.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/workspace-preview-attempt-1-text-artifact.png` | Tiny generated text-like artifact on the camera; not used in the screenshot. |
| Original video-prep pair | FLUX, 35° / 5° / 1.2; 21,184 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/3f3143e0-0990-4a4c-a5bc-e53282cfd5a7.webp` | Superseded public WebPs recoverable from git history | Rejected after user visual review: the dancer changed pose between frames, so the pair did not clearly prove a camera-only viewpoint change. |
| Video prep replacement attempt 1 | FLUX, 45° / 3° / 1.2; 17,878 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/d3283446-a91f-4f7d-9264-aa35804c780d.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/video-45-v2-flux-composition-drift.png` | Rejected at 1152 × 864 original detail: the mannequin became too small and the hand/coat composition drifted. |
| Video prep replacement attempt 2 | Qwen, 45° / 3° / 1.5; 10,426 ms; $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/6790f8ae-99d5-4bad-bded-0bf7cbf452e8.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/video-45-v2-qwen-weaker-viewpoint.png` | Rejected only in favor of the stronger final: excellent identity and composition fidelity, but the viewpoint change was less immediately legible than the accepted 69° result. |

## Post-commit visual-review remediation

The original committed hero elevated and storyboard elevated outputs were explicitly reclassified as rejected after original-detail review. The same accepted ImageGen source PNGs were re-uploaded to the authenticated Angle tool. Every retry is retained and logged below; only rows marked accepted were converted into the two replacement public WebPs.

| Attempt | Engine | Rotation | Tilt | Zoom | Latency | Cost | Render URL | Result status and evidence |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Hero elevated review retry 1 | FLUX Multiple Angles | 45° | 18° | 1.2 | 22,842 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/79a5023b-8e4d-4885-991a-bcc2910cfcce.webp` | Rejected at 1152 × 864 original detail: severe open-mechanical top-body drift and pseudo-text. Preserved as `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/hero-elevated-review-retry-1-pseudotext-identity-drift.png`. |
| Hero elevated review retry 2 | FLUX Multiple Angles | 45° | 18° | 1.2 | 18,945 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/9771090a-3ee7-4003-91b9-7fd34169d01c.webp` | Rejected at 1152 × 864 original detail: top remained open/garbled and lens markings remained unstable. Preserved as `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/hero-elevated-review-retry-2-top-geometry-pseudotext.png`. |
| Hero elevated review retry 3 | Qwen Multiple Angles | 45° | 18° | 1.2 | 9,900 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/84f8148b-cf7e-4050-86f3-b8872949596e.webp` | Rejected at original detail: perforated/altered top plate, pseudo-symbols, and a weak nearly eye-level viewpoint despite tilt 18°. Preserved as `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/hero-elevated-review-retry-3-qwen-weak-elevation-top-geometry.png`. |
| Hero elevated review retry 4 | FLUX Multiple Angles | 45° | 18° | 1.2 | 18,456 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/b02f2957-4c15-4614-9488-63d84f29a15f.webp` | Accepted at 1152 × 864 original detail: clear elevated view, flush top panel, coherent cage/body, no protruding mesh, no melted region, and stable lens markings. Full PNG: `.superpowers/sdd/angle-orbit/task-4-sources/angle/accepted/hero-elevated-review-replacement.png`. |
| Storyboard elevated review retry 1 | FLUX Multiple Angles | 35° | 15° | 1.2 | 16,880 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/a3ccb9d9-2443-419c-b703-96732d6b7a46.webp` | Rejected at 1152 × 864 original detail: face/ear became translucent and disconnected under the hair, worsening identity and geometry. Preserved as `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/story-elevated-review-retry-1-severe-face-geometry.png`. |
| Storyboard elevated review retry 2 | Qwen Multiple Angles | 35° | 15° | 1.2 | 9,911 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/e0906a15-a91c-4448-9c58-1c69a64fca58.webp` | Accepted at original detail: sharp anatomically coherent eyes/nose/cheeks, matching hair/beard/coat identity, complete subject, and clear elevated viewpoint. Full PNG: `.superpowers/sdd/angle-orbit/task-4-sources/angle/accepted/story-elevated-review-replacement.png`. |

## Hero dialogue replacement

The cinema-camera packshot was superseded on 2026-07-13 after user review. The replacement is a four-frame cinematic dialogue sequence built from one new ImageGen source and three genuine Qwen Multiple Angles transformations. The original packshot assets remain recoverable from git history; no additional public asset path was introduced.

### Replacement ImageGen source

Built-in ImageGen was called once with this full prompt:

```text
Use case: photorealistic-natural. Asset type: premium 4:3 landing-page hero source image demonstrating cinematic camera-angle generation through dialogue coverage. Primary request: create one coherent side-on master two-shot of two fictional adult actors in a quiet conversation, designed so later camera rotations can produce a clear field and reverse-field pair. Scene: a refined contemporary hotel bar at blue hour, warm amber practical lamps inside, large cool-blue window in the background, dark walnut and pale limestone materials, elegant but uncluttered, no signage and no other people. Actor A: adult woman seated screen-left, chin-length dark wavy hair, burnt-sienna tailored jacket over an ivory blouse, calm focused expression. Actor B: adult man seated screen-right, short salt-and-pepper hair, deep teal tailored jacket over a charcoal shirt, calm focused expression. Blocking: actors sit opposite each other at a small round dark-walnut table, bodies and faces in readable three-quarter profile, matching eyelines, Actor A remains screen-left and Actor B screen-right, hands separated and resting naturally, two identical clear water glasses only. Style: premium contemporary cinematic editorial photography, natural skin texture, restrained color grade, realistic fabrics and architecture, sophisticated human drama rather than advertising. Composition: landscape 4:3, medium-wide waist-up two-shot, both complete heads and shoulders comfortably inside face-safe margins, actors occupy about 70 percent of the frame together, enough depth behind each shoulder for later over-the-shoulder views, 50 mm cinema lens character, no exaggerated bokeh. Lighting: soft warm key light on both faces balanced with cool blue-hour window light, luminous and readable rather than dark. Constraints: exactly two fictional adult people, stable neutral seated poses, no celebrity likeness, no waiter, no crowd, no extra limbs, no merged hands, no duplicate props, no alcohol branding, no logo, no text, no watermark, no production equipment, no product packshot, no surreal geometry.
```

The accepted generated PNG is `/Users/adrienmillot/.codex/generated_images/019f5a77-03ca-7320-a5a4-a641aae33caf/exec-914f1a96-70ad-4f2e-8f8b-75d86d802db5.png`; its preserved project evidence is `.superpowers/sdd/angle-hero-dialogue/imagegen/accepted/source.png`. It is 1448 × 1086 and passed the pre-Angle audit for exactly two actors, two glasses, readable hands, matching eyelines, distinct wardrobe, no text, and face-safe 4:3 framing. The authenticated upload URL was `https://media.maxvideoai.com/user-assets/301cc489-d689-477f-94c4-0b051deda0bc/c36e5444-ea61-4fa7-81d3-6baf454e3ffa.png`.

### Replacement Angle generations

All attempts used Qwen Multiple Angles, safe mode, single-output generation, and the same uploaded source. The public `45` and `90` filenames remain stable internal URLs; the table records the actual accepted rotations.

| Attempt | Rotation | Tilt | Zoom | Latency | Cost | Render URL | Preserved file | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Field attempt 1 | 56° | 2° | 1.2 | 9,315 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/c70cec6f-8e31-4c30-81f0-01fea3548901.webp` | `.superpowers/sdd/angle-hero-dialogue/angle/rejected/field-56-qwen-wide-two-shot.png` | Rejected: identity and wardrobe were stable, but the view remained a wide two-shot rather than a legible over-the-shoulder field. |
| Reverse on Actor A | 92° | 2° | 1.2 | 12,428 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/ab479933-930e-4d75-8922-cef256dc4fdc.webp` | `.superpowers/sdd/angle-hero-dialogue/angle/accepted/reverse.png` | Accepted at 1440 × 1072: genuine over-Actor-B reverse, sharp Actor A face, matching wardrobe and eyeline, coherent table and hotel-bar setting. |
| Field on Actor B | 272° | 2° | 1.2 | 10,546 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/045e7e62-f03e-4946-a023-085d80aa07f3.webp` | `.superpowers/sdd/angle-hero-dialogue/angle/accepted/field.png` | Accepted at 1440 × 1072: complementary over-Actor-A field, sharp Actor B face, matching screen direction, wardrobe, window light, and furniture. |
| Elevated dialogue view | 20° | 18° | 1.2 | 9,958 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/9aedaff6-ff00-4a3f-a5a4-d2829db2c1bb.webp` | `.superpowers/sdd/angle-hero-dialogue/angle/accepted/elevated.png` | Accepted at 1440 × 1072 with cinema-safe guardrails: clearly elevated composition, both actors, two glasses, round table, stable costumes, faces, and hotel-bar architecture. |

Original-detail review confirmed that the accepted field and reverse form an unmistakable shot/reverse-shot pair. The actors retain their hair, burnt-sienna/deep-teal wardrobe split, seated relationship, and eyelines. The elevated view preserves the same table, two glasses, chairs, and blue-hour environment without text, watermark, duplicated people, malformed hands, or furniture distortion.

## Authenticated workspace capture

The accepted hero source was loaded in `https://maxvideoai.com/app/tools/angle` with a clean FLUX 45° / 3° / 1.2 result visible. A Playwright screenshot from the authenticated Chrome tab captured page coordinates `x=215, y=180, width=1320, height=811` into `.superpowers/sdd/angle-orbit/task-4-sources/workspace/workspace-main-raw.png` (117,577 bytes). The sticky 68 px navigation strip was then removed locally, yielding the exact workspace-only source crop `left=0, top=68, width=1320, height=743` before resizing to 1600 × 900.

Privacy audit: the final crop contains the source upload, camera selector, accepted output, control values, latency/cost, and previous-job thumbnails. It contains no account menu, email address, wallet balance, sidebar, or browser chrome.

## Final conversion audit

All public assets were encoded by the installed frontend Sharp runtime as WebP at quality 82. Fourteen assets are 1600 × 1200 and the workspace capture is 1600 × 900.

The public filename `angle-orbit-video-45.webp` is retained as a stable internal asset URL even though the selected replacement was generated at 69°.

| Public file | Dimensions | Bytes |
| --- | ---: | ---: |
| `angle-orbit-ad-45.webp` | 1600 × 1200 | 77,552 |
| `angle-orbit-ad-source.webp` | 1600 × 1200 | 76,560 |
| `angle-orbit-hero-45.webp` | 1600 × 1200 | 57,086 |
| `angle-orbit-hero-90.webp` | 1600 × 1200 | 65,184 |
| `angle-orbit-hero-elevated.webp` | 1600 × 1200 | 123,536 |
| `angle-orbit-hero-source.webp` | 1600 × 1200 | 82,860 |
| `angle-orbit-product-45.webp` | 1600 × 1200 | 96,468 |
| `angle-orbit-product-source.webp` | 1600 × 1200 | 132,828 |
| `angle-orbit-proof-45.webp` | 1600 × 1200 | 120,548 |
| `angle-orbit-proof-source.webp` | 1600 × 1200 | 266,278 |
| `angle-orbit-story-elevated.webp` | 1600 × 1200 | 89,618 |
| `angle-orbit-story-source.webp` | 1600 × 1200 | 86,264 |
| `angle-orbit-video-45.webp` | 1600 × 1200 | 58,208 |
| `angle-orbit-video-source.webp` | 1600 × 1200 | 83,002 |
| `angle-orbit-workspace.webp` | 1600 × 900 | 76,816 |

All files are below the 500 KB hard limit. Fourteen are below the 200 KB target; `angle-orbit-proof-source.webp` is 266,278 bytes and remains below the hard limit at the required quality 82. The current dialogue hero source and three Angle outputs were inspected at original detail before conversion and again at 1600 × 1200 after WebP encoding; the field/reverse pair has stable identities, wardrobe, eyelines, and no text, watermark, malformed hands, or weak viewpoint change. The storyboard replacement remains anatomically coherent, and the replacement video pair remains prominent, consistently dressed, and posed across a clearly different viewpoint.
