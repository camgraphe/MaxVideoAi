# MaxVideoAI Toolbox — preliminary discovery brief

**Status:** discovery brief, not an implementation plan  
**Date:** 2026-09-07  
**Last research update:** 2026-09-08  
**Purpose:** give the ongoing application redesign a concrete product and technical direction for the Tools page without starting that redesign in parallel.

## Executive decision

Turn `/app/tools` into a curated MaxVideoAI toolbox with two clearly different product levels:

1. **Quick tools** — compact, outcome-oriented tiles such as Restore Video, Remove Background, Upscale, Denoise, Fix Blur, Smooth Motion, and Smart Reframe.
2. **Creative studios** — larger workflows such as Character Builder, Storyboard, and Camera Angle.

The customer chooses a result, not a provider or model. A tile should say “Denoise Video,” not “Topaz Nyx,” and “Upscale Video,” not “SeedVR vs FlashVSR vs Topaz.” MaxVideoAI owns the provider choice, input mapping, quality preset, fallback strategy, pricing, and output normalization.

The initial catalog should stay deliberately small. Launch only tools that are useful, visually understandable, reliable, economically predictable, and simple enough to expose through the web app, editor, and MCP with the same server contract.

## Important LTX clarification

The specialized LTX family the product team remembers is **LTX 2.3 Quality**, not the current LTX 2.5 launch.

- [LTX 2.5](https://fal.ai/ltx-2.5) currently focuses on text-to-video, image-to-video, and audio-to-video in Fast and Pro variants. The fal sitemap contains exactly those six inference routes under `lightricks/ltx-2.5/*` as of 2026-09-08; no 2.5 cleanup, deblur, denoise, outpaint, or reframe endpoint is currently published there.
- [LTX 2.3](https://fal.ai/ltx-2.3) includes specialized workflows such as Reframe, Retake, Extend, Inpaint, Reference Video-to-Video, Render-to-Real, and HDR.
- The less-visible `ltx-2.3-quality/*` collection also contains dedicated **Deblur**, **Decompression / Denoise**, **Clean Plate**, **Colorization**, **Day to Night**, **Outpaint**, and several effect-specific transformations.
- The “denoise” wording visible in LTX Reference Video-to-Video refers to a diffusion **denoise strength** parameter. It is not the same thing as removing sensor noise, grain, or compression artifacts from an existing video.
- However, [LTX 2.3 Quality Decompression](https://fal.ai/models/fal-ai/ltx-2.3-quality/decompression) is a real purpose-built decompression/denoise endpoint, and [LTX 2.3 Quality Deblur](https://fal.ai/models/fal-ai/ltx-2.3-quality/deblur) is a real purpose-built deblur endpoint. Both belong in the benchmark against the equivalent Topaz tools.

LTX 2.3 is therefore much more relevant to the toolbox than the first pass suggested. The key distinction is not “LTX for generation, Topaz for cleanup”; it is **generative restoration versus faithful restoration**. MaxVideoAI should benchmark both and expose the result as one stable customer-facing tool.

## Product principles

### 1. Capability-first, provider-agnostic

Public product concepts remain stable:

- Remove Background
- Upscale Video
- Denoise Video
- Fix Motion Blur
- Smooth Motion
- Smart Reframe

Providers and model IDs stay server-side implementation details. MaxVideoAI can replace an implementation after a benchmark or pricing change without renaming the tile, breaking editor projects, or changing the MCP surface.

### 2. Curated, not exhaustive

A model being available on fal does not justify a public tile. Every tool must pass these gates:

- solves a common and legible user problem;
- produces a predictable output type;
- has a short input form with no provider-specific jargon;
- has a cost that can be quoted before execution;
- persists the original and output in the media library;
- can be invoked by the editor and MCP through the same contract;
- reaches an acceptable quality and reliability score on MaxVideoAI's own benchmark set.

### 3. One simple action per quick tool

A quick tool should normally have:

- one primary input asset;
- zero to three meaningful controls;
- a before/after preview where appropriate;
- an exact quote before the paid run;
- one primary action;
- a normalized output that can be downloaded, saved, sent to the editor, or reused in another tool.

If a feature requires timelines, masks, several reference assets, or a multi-step creative process, it should open a richer workspace instead of forcing those controls into a small tile.

### 4. Presets describe quality, not infrastructure

Use **Standard** and **Pro** as the customer-facing quality levels when two implementations genuinely earn their place. Do not expose `Nyx Fast`, `FlashVSR`, or another provider/model label. MaxVideoAI may map a tier to a different implementation by task, resolution, duration, or benchmark result.

- **Standard** is the best-value implementation that already clears the non-negotiable quality and reliability gates. It must never mean “cheap but visibly bad.”
- **Pro** is offered only when a more expensive route produces a repeatable, perceptible gain on the relevant failure cases. It receives an exact higher quote before execution.
- If only one candidate clears the bar, expose one good tool rather than manufacturing a weak Standard or a cosmetic Pro tier.
- A generative reconstruction must be disclosed as such. It cannot silently replace a faithful restoration route merely because its aggregate benchmark score is higher.

The provider cost is therefore a ranking criterion **after** quality qualification, not a shortcut around it.

### 5. Minimum quality gate before price comparison

For every capability, reject a candidate before commercial scoring if it fails any release-blocking condition on the benchmark corpus:

- identity, face, hand, logo, or text drift beyond the task's intended edit;
- temporal flicker, geometry wobble, halos, cut-boundary failures, or unstable masks;
- unexpected crop, duration, frame-rate, resolution, audio, color-space, or container changes;
- unacceptable failure/timeout rate or quote-to-invoice variance;
- an input limit so restrictive that the tile's public promise becomes misleading.

Among the candidates that remain, choose the lowest total cost that reaches the target quality. Promote a costlier candidate to Pro only when the improvement is visible in blinded review and useful to customers, not merely different.

## Recommended Tools page structure

### Quick tools

Use a dense responsive grid of small tiles. Each tile should contain:

- a simple icon or restrained before/after visual;
- a strong verb-led title;
- one-line description;
- input/output badge such as `Video → Video`;
- optional `Popular`, `New`, or starting-price label;
- a single `Open` action.

Suggested categories:

- **Enhance:** Restore Video, Upscale, Denoise, Fix Blur, Smooth Motion.
- **Edit:** Remove Background, Smart Reframe, Extend Clip, Retake Segment.
- **Publish:** Add Subtitles; possibly Colorize later.

The page can offer lightweight category chips or search once the catalog is large enough, but the first version should not need complex navigation.

### Creative studios

Keep Character Builder, Storyboard, and Camera Angle as larger editorial cards beneath or beside the quick-tool grid. These are multi-step MaxVideoAI workflows and deserve more visual weight than a one-action utility.

### Reusable interaction surface

A quick tile should open the same reusable tool surface whether it appears:

- on `/app/tools`;
- inside the editor;
- from an asset's contextual actions;
- through an MCP-hosted UI.

This can be a route, panel, or drawer depending on the redesign. The important constraint is that the form schema, quote, execution, and result lifecycle are shared rather than rebuilt for each placement.

## Curated launch recommendation

The costs below are fal list prices observed on 2026-09-07 and updated on 2026-09-08. They are discovery inputs, not hard-coded commercial commitments. The public examples apply a `2.5×` multiplier and round only for readability.

| Priority | MaxVideoAI tool | Leading implementation candidate | Provider-cost example | Example public price at 2.5× | Recommendation |
| --- | --- | --- | ---: | ---: | --- |
| P0 | Restore Video | BytePlus VOD vCube Standard; benchmark Pro only as an optional tier | 10 s, 1080p, ≤30 fps: Standard ≈ $0.0689; Pro ≈ $0.6887 | ≈ $0.17 / $1.72 before floor | Strong all-in-one candidate for automatic super-resolution, denoise/sharpen/color repair, and optional interpolation. Pro costs 10× and must prove a visible gain. |
| P0 | Remove Background | Existing Bria VRMBG 3 integration; benchmark against VEED Fast | Existing config: $0.00425/input second; 10 s = $0.0425 | ~$0.11 before floor | Keep and simplify. It already has a product route, billing, and persistence. Hide engine identity. |
| P0 | Upscale Video | Benchmark ByteDance against Topaz Precision, FlashVSR, and current SeedVR2 | ByteDance Standard: 10 s, 1080p, 30 fps = $0.072; Topaz = $0.20 | $0.18 / $0.50 | Keep, but replace the public model picker with intent presets. ByteDance is the new price/performance candidate. |
| P0 | Denoise Video | Benchmark Topaz Nyx against LTX 2.3 Quality Decompression | Topaz Nyx: 10 s, 1080p, 30 fps = $0.20. LTX example: 121 frames at 1280×720 = $0.27 | $0.50 Topaz example / $0.68 LTX example | Strong first new tool. Topaz is cheaper and handles longer/higher-resolution inputs; LTX may reconstruct compression damage more aggressively. |
| P0 | Fix Motion Blur | Benchmark Topaz Themis 2 against LTX 2.3 Quality Deblur | Topaz: 10 s, up to 1080p, 30 fps = $0.10. LTX example: 121 frames at 1280×720 = $0.27 | $0.25 Topaz example / $0.68 LTX example | Strong first new tool. Test faithful sharpening versus generative reconstruction and identity drift. |
| P0 | Smooth Motion | Topaz Apollo or Chronos interpolation | 10 s, 1080p, 30→60 fps = $0.30 | $0.75 | Useful for generated video and slow motion. Quote from output FPS and duration. |
| P1 | Smart Reframe | Benchmark Wan Long Reframe, Luma Ray 2 Flash, and LTX 2.3 | 10 s at 720p: Wan ≈ $0.40; Luma = $0.60; LTX = $1.00 | $1.00 / $1.50 / $2.50 | Wan and Luma are materially cheaper. Benchmark fidelity and maximum useful duration. |
| P1 | Add Subtitles | fal Workflow Utilities; benchmark output against VEED | fal utility = $0.03/min; VEED = $0.10/min base | $0.075 before floor / $0.25 | The fal utility is simple and far cheaper; VEED remains a challenger for quality and translation. |
| P1 | Extend Clip | LTX 2.3 Extend | 10 generated seconds = $1.00 | $2.50 | Good editor integration; present as generative creation, not deterministic cleanup. |
| P1 | Retake Segment | LTX 2.3 Retake | 10 generated seconds = $1.00 | $2.50 | Powerful, but needs a time-range UI and clear audio/video scope. |
| P2 | Remove Object | VOID Video Inpainting; benchmark against Bria Eraser and LTX 2.3 Inpaint | VOID = $0.05/video, +$0.05 SAM3 mask, +$0.05 Pass 2 | Up to $0.375 for the full $0.15 path | High value and surprisingly inexpensive, but masking and temporal consistency make it a richer workflow. |
| P2 | Render-to-Real | LTX 2.3 Render-to-Real | Example 121 frames at 1280×720 ≈ $0.27 | ≈ $0.68 | Useful for 3D/CG users, but narrower audience and generative semantics. |
| P2 | Colorize Video | Topaz Colorize | 10 s, up to 1080p, 30 fps = $0.10 | $0.25 | Simple mapping but lower priority than restoration tools. |

### Proposed first catalog

The cleanest launch foundation is one broad repair entry point plus five legible quick actions:

1. Restore Video — automatic everyday repair.
2. Remove Background.
3. Upscale Video.
4. Denoise Video.
5. Fix Blur.
6. Smooth Motion.

`Restore Video` avoids asking non-expert users to diagnose compression, noise, softness, and frame-rate problems. The focused tools remain useful when a user knows exactly what needs changing or wants lower, more predictable cost. Add Smart Reframe as the first P1 pilot once its benchmark passes; it will validate whether generative video workflows belong in the same quick-tool interaction or require a richer editor surface.

Character Builder, Storyboard, and Camera Angle remain the initial Creative Studios.

## Candidate details and pricing observations

### Video enhancement

[Topaz on fal](https://fal.ai/topaz) currently exposes a coherent video utility suite: Precision, Generative, and Creative Upscale; Denoise; SDR-to-HDR; Frame Interpolation; Deblur; and Colorize.

- [Precision Upscale](https://fal.ai/models/topaz/upscale/video/precision) is the faithful upscale candidate. At 30 fps, fal lists approximately $0.10 for 10 s at 720p, $0.20 at 1080p, and $0.60 at 4K.
- [Generative Upscale](https://fal.ai/models/topaz/upscale/video/generative) is substantially more expensive and may invent detail: roughly $1.20 for 10 s at up to 1080p or $2.60 at 4K with the main model. It should be a clearly labeled `Pro — AI reconstruction` option only if benchmarks justify it.
- [Denoise](https://fal.ai/models/topaz/denoise/video) uses Nyx variants. At 30 fps, the standard path is approximately $0.20 for 10 s at 1080p; Nyx Fast is approximately $0.10.
- [Deblur](https://fal.ai/models/topaz/deblur/video) uses Themis 2 and is approximately $0.10 for 10 s at up to 1080p.
- [Frame Interpolation](https://fal.ai/models/topaz/interpolate/video) uses Apollo, Chronos, or Aion and supports outputs up to 120 fps. A 10 s 1080p 30→60 fps Apollo/Chronos example is approximately $0.30.
- [SDR-to-HDR](https://fal.ai/models/topaz/sdr-to-hdr/video) is approximately $2.40 for 10 s at up to 1080p and introduces color-management and output-format questions. It should not be an initial generic tile.

Alternative upscale candidates already close to the product architecture include [FlashVSR](https://fal.ai/models/fal-ai/flashvsr/upscale/video) at $0.0005 per megapixel-frame and the existing SeedVR2/Topaz paths. The winning internal route should be selected by corpus benchmark, not brand familiarity.

[ByteDance Video Upscaler](https://fal.ai/models/fal-ai/bytedance-upscaler/upscale/video) is an especially strong newly identified candidate. Its Standard/Fast price at 30 fps is $0.0072 per second for 1080p, $0.0144 for 2K, and $0.0288 for 4K. It also exposes useful internal routing dimensions—general, UGC, short-series, AIGC, and old-film presets; Fast, Standard, and Pro tiers; fidelity; target FPS; and up to 8K. The Pro tier costs 10× more, so MaxVideoAI should not select it automatically without an exact quote and measurable quality gain.

[FLUX Video Upscale](https://fal.ai/models/blackforestlabs/flux-video-upscale) offers faithful and creative modes at 1080p, 2K, and 4K, but starts at $1.40 for 10 seconds at 1080p in precise mode. [Crystal Video Upscaler](https://fal.ai/models/clarityai/crystal-video-upscaler) is similarly premium at $0.10 per output megapixel-second. Both may be useful benchmark ceilings, but neither currently looks like the best default-price route.

### Background removal

The existing MaxVideoAI Bria integration is already wired into product billing and persistence. [VEED Background Removal](https://fal.ai/models/veed/video-background-removal), [VEED Fast](https://fal.ai/models/veed/video-background-removal/fast), and [Pixelcut Video Background Removal](https://fal.ai/models/pixelcut/video-background-removal) are useful benchmark challengers because they offer alpha-oriented outputs and straightforward batch APIs.

At 30 fps, VEED Fast with refinement is $0.012 per 30 frames, or approximately $0.12 for a 10-second clip. That is substantially above the current Bria configuration's $0.0425 for 10 seconds, so it should replace Bria only if quality or operational reliability is materially better.

**Pricing audit required before relying on that comparison:** the repository maps `bria/video/background-removal/v3` to $0.00425 per second, but fal's current [queued VRMBG 3 page](https://fal.ai/models/bria/video/background-removal/v3) lists $0.05 per second. The approximately $0.0042 price now belongs to [Bria VRMBG 3 Realtime](https://fal.ai/models/bria/video/background-removal/realtime), a WebRTC-oriented endpoint rather than the queued batch endpoint. This may reflect a private/negotiated rate, a recent fal price change, or stale configuration. It must be reconciled against actual invoices before changing prices or scaling usage; otherwise the queued path could be under-costed by roughly 11.8×.

### LTX generative editing

- [Reframe](https://fal.ai/models/fal-ai/ltx-2.3/reframe) performs generative aspect-ratio conversion rather than a simple crop. fal lists $0.10/input second at 720p and $0.20/input second at 1080p.
- [Extend](https://fal.ai/models/fal-ai/ltx-2.3/extend-video) adds 2–20 seconds at the start or end for $0.10/generated second.
- [Retake](https://fal.ai/models/fal-ai/ltx-2.3/retake-video) regenerates a selected portion of video, audio, or both for $0.10/generated second.
- [Inpaint](https://fal.ai/models/fal-ai/ltx-2.3-quality/inpaint) accepts a source video, mask video, and prompt. fal lists $0.0024075 per generated megapixel-frame; its shown 121-frame 1280×720 example is approximately $0.27.
- [Render-to-Real](https://fal.ai/models/fal-ai/ltx-2.3-quality/render-to-real) uses the same megapixel-frame price basis; the higher-resolution detail-refine path costs materially more.

These tools modify or synthesize content. Their UI must explicitly distinguish them from faithful cleanup operations. A user should never infer that Smart Reframe or Retake will preserve every pixel outside the requested edit.

### Other providers covering the same utility jobs

The useful MaxVideoAI catalog should be capability-led, so LTX and Topaz should be treated as candidates rather than the catalog itself.

| Capability | Serious fal candidates found | Current economic read |
| --- | --- | --- |
| Upscale / restore | [ByteDance](https://fal.ai/models/fal-ai/bytedance-upscaler/upscale/video), [Topaz Precision](https://fal.ai/models/topaz/upscale/video/precision), [FlashVSR](https://fal.ai/models/fal-ai/flashvsr/upscale/video), [SeedVR2](https://fal.ai/models/fal-ai/seedvr/upscale/video), [FLUX](https://fal.ai/models/blackforestlabs/flux-video-upscale), [Crystal](https://fal.ai/models/clarityai/crystal-video-upscaler), Bria Increase Resolution | ByteDance Standard is the standout price candidate; Topaz is the faithful professional baseline; FLUX/Crystal are premium challengers. |
| Denoise / decompression | [Topaz Nyx](https://fal.ai/models/topaz/denoise/video), [LTX 2.3 Quality Decompression](https://fal.ai/models/fal-ai/ltx-2.3-quality/decompression) | Topaz is cheaper, supports longer/high-resolution footage; LTX is a short 480p/720p generative reconstruction candidate. |
| Deblur | [Topaz Themis 2](https://fal.ai/models/topaz/deblur/video), [LTX 2.3 Quality Deblur](https://fal.ai/models/fal-ai/ltx-2.3-quality/deblur) | Same faithful-versus-generative comparison; LTX costs about $0.27 for its documented five-second 720p example. |
| Smooth motion / slow motion | [Topaz Interpolate](https://fal.ai/models/topaz/interpolate/video), [RIFE](https://fal.ai/models/fal-ai/rife/video), [FILM](https://fal.ai/models/fal-ai/film/video) | RIFE/FILM are inexpensive compute-priced challengers; Topaz has clearer output-tier pricing and professional variants. Benchmark scene cuts and large motion. |
| Smart Reframe / Expand Frame | [Wan Long Reframe](https://fal.ai/models/fal-ai/wan-vace-apps/long-reframe), [Luma Ray 2 Flash](https://fal.ai/models/fal-ai/luma-dream-machine/ray-2-flash/reframe), [LTX 2.3 Reframe](https://fal.ai/models/fal-ai/ltx-2.3/reframe), [LTX Quality Outpaint](https://fal.ai/models/fal-ai/ltx-2.3-quality/outpaint) | At 720p, Wan is about $0.04/s, Luma $0.06/s, and LTX Reframe $0.10/s. LTX Quality Outpaint is for short prompted expansion. |
| Remove object/person | [VOID](https://fal.ai/models/fal-ai/void-video-inpainting), [Bria Eraser Prompt](https://fal.ai/models/bria/video/erase/prompt), LTX Inpaint, LTX Clean Plate | VOID has the best published economics: $0.05 base, $0.10 with Pass 2, plus $0.05 for automatic SAM3 masking. Bria costs $0.14/s and is limited to under five seconds. |
| Remove background | Bria queued/realtime, [VEED Fast](https://fal.ai/models/veed/video-background-removal/fast), [Pixelcut](https://fal.ai/models/pixelcut/video-background-removal) | Benchmark alpha edges, hair, products, motion, audio, and export compatibility; audit the Bria price/endpoint mismatch first. |
| Auto subtitles | [fal Workflow Utilities](https://fal.ai/models/fal-ai/workflow-utilities/auto-subtitle), [VEED Subtitles](https://fal.ai/models/veed/subtitles) | fal utility is $0.03/min and already supports word highlighting and styling; VEED starts at $0.10/min and adds translation options. |

This comparison changes the likely default shortlist: **ByteDance deserves the first upscale benchmark slot; Wan and Luma deserve the first reframe benchmark slots; VOID deserves the first object-removal prototype; and LTX Quality Decompression/Deblur deserve quality-challenger slots rather than automatic default status.**

### Direct-provider opportunities already close to MaxVideoAI

The repository already has direct BytePlus ModelArk/LAS, Google Vertex, and Luma Agents adapters. That makes direct-provider evaluation worthwhile, but an existing vendor relationship does not imply that every adjacent API is already integrated or cheaper.

#### BytePlus VOD vCube: strongest fit for an everyday `Restore Video` tool

[BytePlus VOD video enhancement](https://docs.byteplus.com/en/docs/byteplus-vod/enhancing_video_quality_via_skill) is the closest match found for the product concept. It combines more than thirty enhancement algorithms and can automatically apply super-resolution, frame interpolation, sharpening, and color enhancement. Its public template surface includes General, UGC, AIGC, Short drama, and Classic film restoration presets, plus Fast, Standard, and Pro processing levels.

The direct [BytePlus VOD pay-as-you-go table](https://docs.byteplus.com/id/docs/byteplus-vod/docs-pay-as-you-go-pricing) lists these output-minute prices at no more than 30 fps:

| vCube level | 720p | 1080p | 2K | 4K | 10 s 1080p provider cost | 2.5× customer target |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fast | $0.1033 | $0.2066 | $0.4132 | $0.8264 | ≈ $0.0344 | ≈ $0.086 before floor |
| Standard | $0.2066 | $0.4132 | $0.8264 | $1.6528 | ≈ $0.0689 | ≈ $0.172 before floor |
| Pro | $2.0661 | $4.1322 | $8.2644 | $16.5288 | ≈ $0.6887 | ≈ $1.722 before floor |

Rates double above 30 fps through 60 fps and double again above 60 fps through 120 fps. A direct 10-second 1080p Standard run is only about 4.5% cheaper than fal's $0.072 ByteDance Standard example, so direct integration is not justified by unit-price savings alone. Its real advantage is the unified restoration pipeline, automatic task selection, and preset control.

This VOD product is **not** part of the current MaxVideoAI BytePlus ModelArk/LAS adapters. It likely requires separate VOD ingestion/storage, API actions, credentials, region enablement, callbacks, and billing reconciliation. Benchmarking through fal is therefore the fastest proof path; a native VOD adapter becomes attractive after quality is proven or if the unified pipeline cannot be reproduced through fal.

BytePlus VOD also exposes useful supporting capabilities at low published prices: voice/background separation at $0.01/min, smart subtitles at $0.057/min, scene segmentation at $0.03/min, face mosaic at $0.15/min, and precision erasure at $2/min. Audio cleanup and privacy blur are stronger everyday candidates than narrow novelty effects.

#### BytePlus ModelArk/LAS: generative edit candidates, not restoration defaults

The current direct Seedance adapters are suited to generation, extension, and prompt-based video editing. BytePlus's [Seedance 2.0 prompt guide](https://docs.byteplus.com/api/docs/ModelArk/2222480) documents adding, removing, or modifying elements, while [LAS Enhanced Video Editing](https://docs.byteplus.com/en/docs/Byteplus_LAS/Enhanced_video_editing) supports scene, object, and person replacement with evaluation/retry logic.

These are candidates for `Magic Edit`, `Replace Object`, or a Pro removal path after controlled tests. They should not sit behind Denoise, Deblur, or Restore because their intended operation is generative and retries can affect both latency and cost.

#### Google: Gemini Omni 1.1 for Pro editing; Veo upscale stays on the watchlist

The user-recalled “Google 1.1” is most likely **Gemini Omni Flash 1.1**, not Veo 1.1. MaxVideoAI already has a direct Vertex Omni adapter. Google's [video editing documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/edit-videos) describes video edits, extension, references, and object insertion/removal.

At Google's [published Gemini video token rates](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing), a rough 10-second video-to-video edit costs about $1.10 provider-side for 720p output and $1.61 for 1080p output, including input video tokens but excluding any additional text/image/audio tokens. The 2.5× targets are therefore roughly $2.75 and $4.02. Omni 1.1 is a credible Pro `Magic Edit` or complex object-removal challenger, not a low-cost cleanup default.

Google separately [announced standalone Veo upscaling](https://cloud.google.com/blog/products/ai-machine-learning/veo-3-1-lite-and-a-new-veo-upscaling-capability-on-vertex-ai) for arbitrary video up to 1080p or 4K. As of this research update it is private preview / announced for public preview, with no dependable public API price. Track it, but do not make the Toolbox launch depend on it. Current Veo generation/extension pricing is also too high to compete with dedicated restoration endpoints for routine cleanup.

#### Luma direct: useful Pro challenger, currently too expensive for Standard

The existing direct Luma Agents adapter exposes video edit and video reframe. Current repository cost data places a 10-second edit at $1.44 for 540p, $2.16 for 720p, and $4.32 for 1080p; reframe is $0.06/s, $0.12/s, and $0.36/s respectively. Luma can enter blinded Pro benchmarks, but Wan, Luma Ray 2 Flash through fal, and LTX currently have more plausible Standard economics for Smart Reframe.

### Small deterministic utilities worth including

The Toolbox should not imply that every useful action needs a named AI model. A secondary `Essentials` group can make the page feel like a lightweight editing utility belt while remaining cheap, predictable, and easy to expose in the editor and MCP:

- Trim / split and merge clips.
- Crop, resize, rotate, and convert aspect ratio without generative fill.
- Compress / convert format and export a social preset.
- Mute, extract, replace, normalize, or separate voice/background audio.
- Create GIF, loop, reverse, thumbnail, or contact sheet.
- Blur faces for privacy and optionally detect scenes.

These do not need Standard/Pro tiers when the result is deterministic. They can use existing media processing or provider utilities and should share the same quote, job, lineage, and output contract as AI-backed tools.

### LTX 2.3 Quality specialized variant inventory

The public fal sitemap and endpoint documentation expose the following specialized `ltx-2.3-quality/*` variants. Most share the same IC-LoRA video-to-video envelope: one source video, optional scene prompt, 480p or 720p output, approximately six seconds maximum at 720p or fifteen seconds at 480p, and a base price of $0.0024075 per generated megapixel-frame. At 121 frames and 1280×720, the provider example is approximately $0.27 and the 2.5× customer target is approximately $0.68.

| Variant | What it does | Toolbox interpretation | Priority |
| --- | --- | --- | --- |
| [Decompression](https://fal.ai/models/fal-ai/ltx-2.3-quality/decompression) | Removes compression artifacts and denoises | Direct challenger for `Denoise Video`; likely stronger reconstruction but more generative than Topaz | P0 benchmark |
| [Deblur](https://fal.ai/models/fal-ai/ltx-2.3-quality/deblur) | Restores an out-of-focus or blurred video | Direct challenger for `Fix Motion Blur`; test whether it handles defocus, motion blur, or both | P0 benchmark |
| [Clean Plate](https://fal.ai/models/fal-ai/ltx-2.3-quality/clean-plate) | Removes the principal character and reconstructs the background | Potential `Remove Person` or `Clean Background` tool; unusually simple input but needs hard tests on occlusion | P1/P2 |
| [Colorization](https://fal.ai/models/fal-ai/ltx-2.3-quality/colorization) | Colorizes monochrome video | Challenger to Topaz Colorize; useful archival niche | P2 |
| [Day to Night](https://fal.ai/models/fal-ai/ltx-2.3-quality/day-to-night) | Converts a daytime scene into night | Clear creative transformation, but not a universal finishing tool | P2 |
| [Outpaint](https://fal.ai/models/fal-ai/ltx-2.3-quality/outpaint) | Expands the canvas to a target aspect ratio using a prompt | Candidate behind `Expand Frame`; compare with Reframe for fidelity, duration, and price | P1 benchmark |
| [Inpaint](https://fal.ai/models/fal-ai/ltx-2.3-quality/inpaint) | Regenerates a masked region | Backend candidate for `Remove Object` or `Replace Object`; mask UX makes it a richer editor tool | P1/P2 |
| [Render-to-Real](https://fal.ai/models/fal-ai/ltx-2.3-quality/render-to-real) | Converts CG/3D footage toward photorealism | Valuable specialist transformation | P2 |
| [HDR](https://fal.ai/models/fal-ai/ltx-2.3-quality/hdr) | Produces an HDR-oriented transformation/output | Specialist; validate real delivery color space and container behavior before product claims | P2/P3 |
| [Cross-eyed](https://fal.ai/models/fal-ai/ltx-2.3-quality/cross-eyed) | Applies a specific eye transformation | Novelty/effect, not a core MaxVideoAI utility | Do not launch initially |
| [Instant Shave](https://fal.ai/models/fal-ai/ltx-2.3-quality/instant-shave) | Removes facial/head hair as a transformation | Novelty or virtual-character effect, too narrow for the main toolbox | Do not launch initially |
| [Water Simulation](https://fal.ai/models/fal-ai/ltx-2.3-quality/water-simulation) | Applies a water-simulation transformation | Creative effect rather than general utility | Do not launch initially |

The broader Quality family also contains general generation/control endpoints—Text-to-Video, Image-to-Video, Audio-to-Video, Ingredient, Reference Video-to-Video, and LoRA variants. Those belong to model generation or advanced control surfaces, not one-click Quick Tool tiles.

#### Practical limitation of the specialized variants

These endpoints are attractive because their public input schemas are nearly identical, which makes them easy to map through one adapter family. But their shared limits matter:

- only 480p and 720p output for most IC-LoRA transformations;
- approximately six seconds at 720p or fifteen seconds at 480p;
- generative reconstruction can change faces, text, logos, fine geometry, or background details;
- the optional prompt may improve the result but makes the operation less deterministic;
- at the documented example size, the LTX run costs about $0.27 before MaxVideoAI's multiplier, versus roughly $0.05–$0.10 for a comparable short Topaz finishing pass depending on tool and resolution.

This suggests a useful internal strategy: default to a faithful conventional implementation when it succeeds, and consider an LTX-powered `AI Restore` or `Reconstruct` quality preset only when its benchmark gain justifies the higher cost and drift risk. Do not silently swap a faithful tool for a generative one without communicating that semantic difference.

### Publishing utility

[VEED Subtitles](https://fal.ai/models/veed/subtitles) starts at $0.10 per input minute with a one-minute minimum. High-resolution input, dynamic styling, and translation add cost. It is a good P1 utility if MaxVideoAI can normalize transcript, style, burned-in output, and editable-caption output cleanly.

## Pricing policy

### Meaning of the 2.5 target

Use `customer price = provider cost × 2.5` as the initial pricing target.

That is a **2.5× multiplier**, equivalent to a 150% markup on provider cost and a 60% gross margin before storage, egress, payment fees, retries, support, refunds, and taxes. Calling it a “2.5 margin” would be ambiguous, so the implementation and brief should consistently say `2.5× provider cost`.

### Recommended quote formula

For variable-cost quick tools:

```text
quoted_customer_price = max(commercial_floor, normalized_provider_quote × 2.5)
```

The provider quote should be computed from the actual billable dimensions: input or output duration, frame rate, resolution, megapixel-frames, selected output FPS, quality preset, and provider minimums.

The commercial floor is important for very cheap jobs. A theoretical $0.11 customer price may not cover storage, egress, payment fees, failed jobs, and support. The floor should be decided from real operational data, not invented inside each tool.

### Existing inconsistency to normalize

The current source contains tool-specific multipliers:

- video upscale dynamic pricing uses `4×`;
- background removal uses `2×`;
- the requested future target is `2.5×`.

Do not change those values as part of the visual redesign. First introduce one canonical quick-tool commercial policy and migrate tools deliberately, with pricing tests and product approval. Exact quotes must continue through the existing canonical billing authority rather than being recomputed in client components or MCP handlers.

## Proposed reusable architecture

### Separate the public tool from its implementation

Conceptually, maintain two registries:

```ts
type ToolDefinition = {
  id: string;
  label: string;
  category: 'enhance' | 'edit' | 'publish';
  inputKinds: Array<'image' | 'video' | 'audio'>;
  outputKind: 'image' | 'video' | 'audio' | 'captions';
  controlsSchema: ToolControlsSchema;
  pricingMeter: ToolPricingMeter;
  activeImplementationId: string;
  editorEligible: boolean;
  mcpEligible: boolean;
};

type ToolImplementation = {
  id: string;
  provider: string;
  providerModelId: string;
  inputMapper: ToolInputMapper;
  outputNormalizer: ToolOutputNormalizer;
  costEstimator: ToolCostEstimator;
  constraints: ToolConstraints;
  status: 'benchmark' | 'active' | 'fallback' | 'retired';
};
```

The exact TypeScript shape should follow existing project conventions; this split is the important design constraint.

### One server-owned execution service

All placements should call a shared server service, tentatively `ToolRunService`, responsible for:

1. validating the tool-level input;
2. resolving the current internal implementation;
3. probing media metadata required for a quote;
4. producing a canonical billing snapshot;
5. requiring explicit confirmation for the exact paid quote;
6. invoking the provider;
7. normalizing and persisting outputs;
8. exposing a provider-agnostic job status and result.

Routes, editor panels, and MCP handlers become adapters around this service. Provider IDs and provider response shapes should never become part of saved editor projects or public MCP arguments.

### Avoid one new job surface per tile

The current jobs/media code enumerates tools such as upscale and background removal individually. Repeating that pattern for ten utilities will spread every new tool across status unions, library projections, UI labels, and filters.

Prefer a generic `tool` surface with a stable `toolId` or capability identifier in typed metadata, while retaining compatibility normalization for existing `upscale` and `background-removal` records. This needs an architecture decision and migration design before implementation; it should not be improvised inside the first new tool.

### Data-driven Tools page

`ToolsWorkspacePage.tsx` currently hand-builds five visually large cards. The redesign should render categorized cards from a presentation-safe projection of the tool registry. That projection contains product copy, icon, route, availability, badges, and input/output kinds—but never provider credentials or sensitive configuration.

This makes it possible to:

- reorder and curate the toolbox without duplicating JSX;
- render the same availability in the editor and MCP discovery;
- distinguish Quick Tools from Creative Studios;
- feature a tool without changing its server identity.

## MCP contract direction

Do not force post-production utilities into the existing video-generation model selector. Expose a separate provider-agnostic tool family, for example:

- `list_tools` — discover enabled MaxVideoAI capabilities and accepted media kinds;
- `get_tool_details` — return controls, constraints, and quote requirements;
- `prepare_tool_run` — validate inputs and return an exact, expiring quote;
- `confirm_tool_run` — explicitly accept the quote and start one paid execution;
- `get_tool_run_status` — poll normalized state;
- `present_tool_result` — render or attach the persisted result.

Existing upload and media-listing capabilities can be reused. The MCP flow should mirror the application's billing lifecycle: preparation is read-only; confirmation is the single paid boundary; retries must be idempotent and must not charge twice.

## Editor contract direction

Editor blocks should store stable product-level data:

```ts
type EditorToolBlock = {
  toolId: string;
  version: number;
  inputAssetIds: string[];
  controls: Record<string, unknown>;
  outputAssetId?: string;
};
```

They should not store a fal endpoint or vendor model. On reopen, MaxVideoAI can resolve the compatible implementation for that tool-version contract. The original asset remains immutable; every run creates a new reusable media asset with lineage back to the input and job.

## Benchmark before provider lock

Documentation and price tables are not enough to select “best quality at the best price.” Run a blinded evaluation over a small fixed corpus.

### Suggested corpus

- faces, hair, hands, and semi-transparent edges;
- low light, grain, and heavy compression;
- camera shake and fast subject motion;
- fine text, UI screens, logos, and repeating patterns;
- animation, CG, and AI-generated video;
- 720p, 1080p, portrait, landscape, and variable frame rate inputs;
- clips with and without audio.

### Two-stage scorecard

Stage 1 is pass/fail. A candidate must clear all applicable release gates before price receives any weight:

| Release gate | Minimum evidence |
| --- | --- |
| Task success | At least 80% of representative clips judged usable without a second repair pass; set a higher threshold for deterministic utilities. |
| Critical preservation | No recurring identity, text/logo, audio, timing, crop, or color-space regression outside the requested edit. |
| Temporal stability | No recurring flicker, mask chatter, edge wobble, scene-cut contamination, or invented motion. |
| Operational reliability | At least 95% successful completion in the test batch, with failures correctly classified and no duplicate billing. |
| Commercial predictability | Estimated and invoiced cost reconcile within the agreed tolerance for every supported input envelope. |

The percentages are proposed starting thresholds, not claims that the providers already meet them. A larger corpus and stricter thresholds are appropriate before broad release.

Stage 2 ranks only the candidates that passed:

| Criterion | Weight |
| --- | ---: |
| Output quality above the minimum bar | 35% |
| Temporal consistency and artifact control above the minimum bar | 20% |
| Provider cost | 20% |
| Latency and operational reliability | 15% |
| Input/output mapping and format simplicity | 10% |

Also record cold/warm latency, timeout rate, provider-reported versus actual output dimensions, audio preservation, file size, codec/container compatibility, and quote-to-invoice variance.

### Provider-selection rule

Activate the highest-scoring implementation that clears every minimum quality threshold and fits the commercial envelope. For Standard, prefer the lowest-cost candidate within a small, predefined quality band of the best qualified result; this prevents paying heavily for an imperceptible gain without rewarding a weak cheap model. Offer Pro only when the costlier winner improves a meaningful failure class in blinded review. Keep a fallback only when it genuinely improves availability; a dormant second provider is not free if its mappings and regressions are untested.

## Delivery phases

### Phase 0 — product and benchmark

- approve the Restore Video entry point, five focused P0 tools, and Smart Reframe P1 pilot;
- build the fixed input corpus and expected-output checklist;
- compare current providers against challengers;
- decide the minimum customer price and rounding/credit policy;
- decide the generic job/media surface before adding several tools.

### Phase 1 — shared foundation and current tools

- create the provider-agnostic tool registry and shared execution contract;
- project a data-driven Quick Tools grid and separate Creative Studios section;
- migrate Upscale and Remove Background behind stable MaxVideoAI tool identities;
- keep existing URLs working;
- remove provider/model selection from the default customer experience;
- add editor-eligibility and MCP-eligibility metadata without exposing unfinished tools.

### Phase 2 — first new finishing tools

- Restore Video after ByteDance/fal and direct BytePlus VOD feasibility are compared;
- Denoise Video;
- Fix Blur;
- Smooth Motion;
- Smart Reframe after its fidelity and cost benchmark passes.

### Phase 3 — generative edit and publishing tools

- Add Subtitles;
- Clean Audio / Separate Voice;
- Extend Clip;
- Retake Segment;
- Remove Object once the masking experience and temporal results are ready.

### Phase 4 — specialist tools only if demand justifies them

- Render-to-Real;
- Colorize;
- SDR-to-HDR;
- Generative or Creative Upscale;
- Lip Sync as a dedicated multi-input workflow rather than a generic cleanup tile.

## Non-goals for the first implementation

- exposing every fal endpoint;
- exposing provider/model names as the main choice;
- adding training endpoints;
- shipping raw depth, edge, pose, or diffusion-control workflows as tiny tiles;
- treating generative edits as deterministic restoration;
- changing existing prices incidentally during visual refactoring;
- duplicating execution logic separately in the page, editor, and MCP;
- rebuilding Character Builder, Storyboard, or Camera Angle as tiny utilities.

## Handoff to the Codex doing the app redesign

Use this document as product input, not as authorization for a broad implementation. The redesign can safely incorporate the following now:

1. Reserve two visual levels: **Quick Tools** and **Creative Studios**.
2. Make the quick-tool card grid data-driven and compact.
3. Design one reusable quick-tool panel with upload, minimal controls, exact quote, progress, before/after result, download, save, and `Open in editor` actions.
4. Keep provider/model names out of customer-facing primary controls.
5. Preserve current routes and behavior while the shared execution architecture is designed.
6. Treat Restore Video, the five focused P0 tools, and the Smart Reframe pilot as a proposed catalog pending benchmarks, not as automatically approved integrations.
7. Do not implement provider routing, generic job-surface migration, or the 2.5× commercial policy as incidental UI work; those require focused contracts, pricing tests, and migration review.

Relevant current implementation points:

- `frontend/app/(core)/(workspace)/app/tools/page.tsx`
- `frontend/src/components/tools/ToolsWorkspacePage.tsx`
- `frontend/src/components/tools/ToolsMarketingHubPage.tsx`
- `frontend/src/config/tools-upscale-engines.ts`
- `frontend/src/config/tools-background-removal-engines.ts`
- `frontend/src/server/mcp/server.ts`
- `tests/upscale-server-architecture.test.ts`
- `tests/upscale-workspace-architecture.test.ts`
- `tests/background-removal-tool-contract.test.ts`
- `tests/pricing-billing-authority.test.ts`

## Open decisions

- Is the first release video-only, or should image Upscale/Denoise appear in the same tiles with a media-type switch?
- Which tools merit both Standard and Pro after blinded testing, and which should expose only one qualified level?
- What is the minimum billable price or credit amount for sub-$0.25 jobs?
- Does Smart Reframe belong in Quick Tools or open directly into the editor because it is generative?
- Should Add Subtitles output only a rendered video, or also persist editable SRT/VTT captions?
- What quality threshold and maximum latency are required before a fallback provider is activated?

These questions do not block the visual brief. They should be answered by the benchmark and pricing work before provider contracts become permanent.
