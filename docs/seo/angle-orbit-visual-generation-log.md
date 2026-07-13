# Angle Orbit visual generation log

Generated and audited on 2026-07-13 for the localized Angle landing page. All six source photographs were created with the built-in ImageGen tool. All eight transformed views were produced in the authenticated MaxVideoAI Angle workspace; no transformed view is an ImageGen substitute.

## Source generation

Every prompt uses this exact common suffix: `landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials`.

| Section | Full ImageGen prompt | Accepted raw source | Result |
| --- | --- | --- | --- |
| Hero | `compact professional cinema camera in black anodized aluminum with realistic optical glass, fasteners and tactile controls, centered on a sculptural ivory plinth, warm museum-gallery light. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/hero-source.png` | Accepted first generation; complete camera, credible materials, no text or logo. |
| Proof | `burnt-orange portable wireless speaker with woven fabric and machined metal controls, straight-on catalog camera, pale limestone studio. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/proof-source.png` | Accepted first generation; clean front view and readable material texture. |
| Product | `cobalt and off-white technical running shoe on a transparent low stand, straight-on commerce view, warm gray seamless studio. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/product-source.png` | Accepted first generation; complete silhouette and clean sole geometry. |
| Storyboard | `solitary actor in a rust coat standing at the edge of a windswept coastal road, eye-level cinematic frame, overcast natural light. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/story-source.png` | Accepted first generation; clear subject and distinct cinematic setting. |
| Ad creative | `faceted clear fragrance bottle with a deep red glass cap, straight-on campaign frame, saturated burgundy and cream set. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/ad-source.png` | Accepted first generation; centered bottle, credible facets, no label text. |
| Video prep | `dancer in a tailored yellow coat at an empty modern railway platform, eye-level cinematic first frame, cool morning light. landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials` | `.superpowers/sdd/angle-orbit/task-4-sources/imagegen/accepted/video-source.png` | Accepted first generation; prominent dancer and coherent station geometry. |

All accepted raw sources are 1448 × 1086 PNG files stored outside `frontend/public` until their genuine Angle derivatives were accepted.

## Authenticated Angle generations

Zoom `1.2` is the actual displayed workspace value for every accepted result. The URLs below are the MaxVideoAI render URLs exposed by the authenticated tool.

| Asset | Engine | Rotation | Tilt | Zoom | Latency | Cost | Render URL | Result status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Hero 45 | FLUX Multiple Angles | 45° | 3° | 1.2 | 7,844 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/23f02af8-3369-4f7f-8982-a09e913bc386.webp` | Accepted: strong three-quarter change, complete camera, credible geometry. |
| Hero 90 | FLUX Multiple Angles | 90° | 2° | 1.2 | 15,844 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/1a252661-565a-46c6-a8ee-a6dbd7fa6f7d.webp` | Accepted: clear profile/rear view and stable identity. |
| Hero elevated (original) | FLUX Multiple Angles | 45° | 18° | 1.2 | 15,214 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/6d700dd5-bfdb-434c-93ec-1f358fea8663.webp` | Rejected by post-commit review: protruding mesh flap, garbled top-body geometry, and pseudo-text lens markings. Removed from the public asset. |
| Proof 45 | FLUX Multiple Angles | 45° | 3° | 1.2 | 21,118 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/9bca5746-9bb1-4c32-ab2c-b2f086bd22a0.webp` | Accepted: meaningful side depth and preserved speaker identity. |
| Product 45 | FLUX Multiple Angles | 45° | 3° | 1.2 | 12,495 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/4041d65c-a6da-45da-8ae2-7fff18f6805c.webp` | Accepted: clear commerce three-quarter and intact shoe geometry. |
| Storyboard elevated (original) | FLUX Multiple Angles | 35° | 15° | 1.2 | 16,240 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/7fad8a0a-d71c-4e07-a767-5ead13aa9d5a.webp` | Rejected by post-commit review: smeared/deformed eye, nose, and cheek caused identity drift. Removed from the public asset. |
| Ad 45 | Qwen Multiple Angles | 45° | 2° | 1.2 | 11,466 ms | $0.08 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/22995160-c14b-4e71-834a-c1985b235747.webp` | Accepted: visible three-quarter facets and preserved bottle volume. |
| Video prep 45 | FLUX Multiple Angles | 35° | 5° | 1.2 | 21,184 ms | $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/3f3143e0-0990-4a4c-a5bc-e53282cfd5a7.webp` | Accepted: strong side/front change with coherent coat, face, and station. |

The accepted full-resolution outputs are persisted under `.superpowers/sdd/angle-orbit/task-4-sources/angle/accepted/` as PNG files. The generated thumbnail URL was not used as the final public asset; each accepted result was downloaded through the workspace Download control.

## Rejection evidence

Rejected results were retained rather than overwritten:

| Attempt | Engine and settings | Render URL | Preserved file | Rejection reason |
| --- | --- | --- | --- | --- |
| Ad 45 attempt 1 | FLUX, 45° / 2° / 1.2; 24,270 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/ceab1508-4dc2-4220-a8ea-35046363ba6a.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/ad-45-attempt-1-weak-viewpoint.png` | Quasi-front framing; viewpoint change was too weak. |
| Ad 45 attempt 2 | FLUX, 45° / 2° / 1.2; 30,277 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/ca65f72f-7208-4d02-9ae5-cd095214127b.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/ad-45-attempt-2-weak-viewpoint.png` | Second quasi-front result; still insufficient viewpoint change. |
| Workspace preview attempt 1 | FLUX, 45° / 3° / 1.2; 23,227 ms; $0.04 | `https://media.maxvideoai.com/renders/thumbs/301cc489-d689-477f-94c4-0b051deda0bc/506f5e43-1d86-4438-93c9-44d9e415c46e.webp` | `.superpowers/sdd/angle-orbit/task-4-sources/angle/rejected/workspace-preview-attempt-1-text-artifact.png` | Tiny generated text-like artifact on the camera; not used in the screenshot. |

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

## Authenticated workspace capture

The accepted hero source was loaded in `https://maxvideoai.com/app/tools/angle` with a clean FLUX 45° / 3° / 1.2 result visible. A Playwright screenshot from the authenticated Chrome tab captured page coordinates `x=215, y=180, width=1320, height=811` into `.superpowers/sdd/angle-orbit/task-4-sources/workspace/workspace-main-raw.png` (117,577 bytes). The sticky 68 px navigation strip was then removed locally, yielding the exact workspace-only source crop `left=0, top=68, width=1320, height=743` before resizing to 1600 × 900.

Privacy audit: the final crop contains the source upload, camera selector, accepted output, control values, latency/cost, and previous-job thumbnails. It contains no account menu, email address, wallet balance, sidebar, or browser chrome.

## Final conversion audit

All public assets were encoded by the installed frontend Sharp runtime as WebP at quality 82. Fourteen assets are 1600 × 1200 and the workspace capture is 1600 × 900.

| Public file | Dimensions | Bytes |
| --- | ---: | ---: |
| `angle-orbit-ad-45.webp` | 1600 × 1200 | 77,552 |
| `angle-orbit-ad-source.webp` | 1600 × 1200 | 76,560 |
| `angle-orbit-hero-45.webp` | 1600 × 1200 | 62,280 |
| `angle-orbit-hero-90.webp` | 1600 × 1200 | 46,928 |
| `angle-orbit-hero-elevated.webp` | 1600 × 1200 | 72,558 |
| `angle-orbit-hero-source.webp` | 1600 × 1200 | 81,096 |
| `angle-orbit-product-45.webp` | 1600 × 1200 | 96,468 |
| `angle-orbit-product-source.webp` | 1600 × 1200 | 132,828 |
| `angle-orbit-proof-45.webp` | 1600 × 1200 | 120,548 |
| `angle-orbit-proof-source.webp` | 1600 × 1200 | 266,278 |
| `angle-orbit-story-elevated.webp` | 1600 × 1200 | 89,618 |
| `angle-orbit-story-source.webp` | 1600 × 1200 | 86,264 |
| `angle-orbit-video-45.webp` | 1600 × 1200 | 53,222 |
| `angle-orbit-video-source.webp` | 1600 × 1200 | 75,358 |
| `angle-orbit-workspace.webp` | 1600 × 900 | 76,816 |

All files are below the 500 KB hard limit. Fourteen are below the 200 KB target; `angle-orbit-proof-source.webp` is 266,278 bytes and remains below the hard limit at the required quality 82. The two post-review replacements were inspected independently at original detail before conversion and again at 1600 × 1200 after WebP encoding; the accepted files have no visible mesh flap, melted body detail, pseudo-text artifact, facial deformation, identity drift, watermark, or weak viewpoint change.
