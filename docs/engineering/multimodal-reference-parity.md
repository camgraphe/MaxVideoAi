# Multimodal reference parity — 22 September 2026

## Ownership

| Model | Exposed image/video/audio references | Frames and soundtrack | Output resolutions |
| --- | --- | --- | --- |
| Wan 3 | 10 images, 5 videos, 5 audio clips; document or webpage context; image/audio references also in edit/extend | Start frame, optional end frame; reference audio can stand alone | 480p, 720p, 1080p |
| Wan 3 Prime | Same roles and limits as Wan 3 | Same roles as Wan 3 | 480p, 720p, 1080p |
| MiniMax H3 | 9 images, 3 videos, 3 audio clips, at most 12 combined; audio-only reference generation | Start, end, or both; separate imposed soundtrack in text/image modes | 480P, 768P, 2K, 4K |
| MiniMax H3 Max | Same counts and roles as H3; reference cost included in the upfront quote | Same frame/soundtrack roles as H3 | 480P, 768P, 1080P |

For all four models, reference video and reference audio each have a 15-second combined duration limit. These limits do not apply to H3's separate imposed soundtrack.

The authored engine input schemas in `frontend/src/config/fal-engines/` own media roles and supported modes. Workspace schema summarization, mode inference, pickers and generation guards consume these roles. The MCP canonical contract projects the same fields into reference requirements and provider-neutral settings. Provider builders must retain exact role assignments: an end frame must never become a start frame, and an imposed soundtrack must not become a reference audio clip.

Wan 3 and Prime expose text, first/last-frame, mixed-reference, editing and extension workflows. Mixed references support images, videos, audio, one document URL or one public webpage URL. Editing and extension accept a source video with optional image and audio references. Frame inputs cannot be combined with reference inputs. Document and webpage inputs are mutually exclusive and require prompt expansion. Explicit output duration remains required for a fixed pre-generation customer quote. Input-video seconds and output seconds both contribute to the quoted provider cost before the existing margin; reference videos count in mixed mode too. Input plus output must stay within 30 seconds. Owned media metadata determines the source duration, and identical video URLs count once.

Wan video-bearing quotes include the verified input-video seconds plus output seconds, including mixed-reference mode. The combined duration cannot exceed 30 seconds. The current price is derived from owned media metadata before generation; client duration claims cannot reduce it. The web pricing revision `standard-references-2026-09-22` rejects older tabs before charging, and MCP confirmation expires a quote when current media facts change. For example, 10 seconds of input plus 5 seconds of output at 720p costs $1.95 for Wan 3 and $2.73 for Prime under the standard 30% markup. No source video means no input-video surcharge.

H3 and H3 Max expose text, image (start, end, or both), and mixed-reference generation. Mixed references may contain only audio. The separate `target_audio_url` in text/image modes pins the original soundtrack; it has a two-second minimum and 15 MB maximum, can be longer than output, and is trimmed or padded without a speed change. The 15-second combined reference-audio limit applies only to reference mode.

Inputs used by these H3 modes must be owned library assets, with persisted MIME, size, dimensions and duration checked as appropriate. Advertised application upload formats are JPEG/PNG/WebP, MP4/MOV and MP3/WAV; these are the application upload contract, not a claim that Fal publishes exhaustive H3 Max media-format or byte limits. New references use the controlled upload/import path. Client-declared pricing metadata is never authoritative.

## H3 Max customer pricing policy

The user authorized conservative pricing with the existing commercial margin on 22 September 2026. Provider reference-token billing is not fully specified for arbitrary video and audio. Do not label an estimated token budget as a verified provider token count or invoice.

`calculateMinimaxH3MaxReferenceTokenBudget` is the pure versioned policy owner. Quote preparation and generation derive the same budget from verified owned asset metadata; confirmation revalidates that metadata and the resulting quote. The estimate is frozen into the customer price before approval, with no later customer top-up based on provider usage.

Version `normalized-media-budget-2026-09-22`:

- Deduplicate identical media kind/URL pairs.
- Images normalize their short edge to 1,024 pixels and round both spatial dimensions upward to a 32-pixel grid. Square uploads contribute 1,024 budget tokens regardless of source megapixels.
- Videos normalize their short edge to 480 or 768 pixels according to native output tier; 1080P refinement uses the 768 tier. Round upward to the same spatial grid and budget eight temporal units per reference second, limited to requested output duration. This is an application cost allowance, not reverse-engineered exact provider billing.
- Audio budgets 96 tokens per stored reference second, retaining a 20% buffer above the published approximate 80/s. Use the full reference duration.
- Pool the first 4,096 reference tokens, then apply the documented prorated $0.02 per 1,000. Output catalog rates are $0.05/s at 480P, $0.08/s at 768P, $0.16/s at 1080P. Temporary supplier promotions are not passed into time-dependent customer pricing.
- Apply the existing canonical pricing policy/membership rules; no new global margin rule is introduced.

The video allowance exceeds the published 24fps examples checked at 2, 5, 10 and 15 seconds, while staying within 50% of their reference-token component. This is measured coverage of those examples, not a guarantee for every future provider behavior or source frame rate. Persisted pricing metadata records the estimate basis/version; compare actual supplier invoices before adjusting this policy. Do not replace it with the old raw-source-megapixel or unconditional tokens-per-second formula.

Examples at 5 seconds/768P before the existing commercial margin: up to four square image references retain the $0.40 output cost basis; five square references produce $0.42048. A 16:9 video reference of at least five seconds receives a 41,280-token budget and a $1.14368 combined output/reference cost basis. An audio-only reference of five seconds remains inside the free token pool. These are dated internal supplier-cost allowances, not advertised customer prices.

## Provider evidence

Verified against live official schemas and pricing on 22 September 2026:

- [MiniMax H3 schema](https://fal.ai/models/minimax/h3/reference-to-video/api)
- [H3 Max reference schema](https://fal.ai/models/minimax/h3-max/reference-to-video/api)
- [H3 Max soundtrack and frame inputs](https://fal.ai/models/minimax/h3-max/image-to-video/api)
- [H3 Max reference pricing](https://fal.ai/models/minimax/h3-max/reference-to-video)
- [Alibaba Wan 3/Prime API](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference)
- [Alibaba input and output video pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

The Fal landing page and old descriptions can lag the live input schemas. Tests cover workspace mode transitions, input retention, frame/reference exclusivity, actual generation validation and provider payloads, media metadata rejection, quote/charge parity and MCP revalidation. Marketing descriptions must describe executable application behavior. Separate specialist endpoints such as camera-control/lip-sync products are not aliases for these video-generation modes.

Wan's automatic duration remains outside the fixed-price contract. Its aspect-ratio selector retains the shared Alibaba/Fal fallback choices; Alibaba's direct-only 21:9 option requires route-specific capability and fallback handling before publication. These are explicit remaining provider differences, rather than claims of complete parity with every separate provider product.

## Validation record

- Production build, TypeScript, frontend lint, public-exposure lint, generated catalog/registry checks and diff checks passed.
- Public pricing baseline: 588 rows; billing audit: 266 scenarios, no unexpected mismatch. MCP client checks: 145 tests and 70 selection scenarios.
- The final standard-suite run covered 5,829 tests. Three failures were resolved and rerun successfully: an architecture file scan raced the concurrent build, and two old Wan positive fixtures needed owned video metadata. The architecture group passed 3/3 afterward; the updated Wan/MCP regression group passed 52/52. The five separate Studio integration cases refuse this checkout's existing environment files, so they are not qualified by this run.
- Browser checks on the local production build confirmed Wan's manual Reference/Edit/Extend controls, document/web fields, H3/Max reference controls, the 50,000-character limit, and H3 Max's 1080P option. Public pages were checked for canonical URLs, localized redirects, hreflang and JSON-LD. Local-only Vercel analytics script 404s were observed.
- No provider generation was purchased, no database settings were manually changed, and no deployment was performed. Actual supplier invoice reconciliation remains necessary to calibrate the H3 Max reference budget.
