# Admin video purchase comparisons

The admin simulator and economic replay use these supplier quotes, checked on 2026-11-27. Each comparison-only candidate carries its rate source. Purchases are estimated in USD using the matching supplier tariff. The dated Wan Prime study and paid dispatch use the offer set in the purchase router.

## WaveSpeedAI

| Wan edition | 480p USD/s | 720p USD/s | 1080p USD/s |
| --- | ---: | ---: | ---: |
| Wan 3 Standard | 0.045 | 0.09 | 0.18 |
| Wan 3 Prime | 0.0675 | 0.135 | 0.27 |

WaveSpeedAI publishes these promotional rates for text, first-frame or paired-frame generation and multimodal references. The simulator preserves frame roles and the exact edition. For reference video, each clip must have a known duration of 1–15 seconds, with up to five clips totaling at most 15 seconds. The source durations and output must fit within 30 seconds. WaveSpeed rounds the **combined** source duration up once. The comparison requires individual validated durations and their matching total. A sound track in the generated clip is supported. Audio references, documents, editing, extension and unreviewed controls have no quote here.

[Standard text](https://wavespeed.ai/models/alibaba/wan-3.0/text-to-video) · [Standard frames](https://wavespeed.ai/models/alibaba/wan-3.0/image-to-video) · [Standard references](https://wavespeed.ai/models/alibaba/wan-3.0/reference-to-video) · [Prime text](https://wavespeed.ai/models/alibaba/wan-3.0-prime/text-to-video) · [Prime frames](https://wavespeed.ai/models/alibaba/wan-3.0-prime/image-to-video) · [Prime references](https://wavespeed.ai/models/alibaba/wan-3.0-prime/reference-to-video).

## MiniMax H3 and H3 Max

The APIMart Gold quote uses the USD equivalent of the published credits. H3 supports 768p at $0.05712/s and 2K at $0.09144/s. Each reference image beyond the first five adds $0.02288. H3 Max supports 480p at $0.03768/s, 768p at $0.05712/s and 1080p at $0.128/s. Each reference image beyond the first two adds $0.05712. The editions have separate scenarios. The comparison requires a prompt within APIMart's 7,000-character limit, native audio, and text or reviewed image roles. An initial frame inherits its input aspect ratio. H3 Max comparisons with Fal currently show text and initial-frame cases because Fal reference mode requires a trusted reference-token budget.

[APIMart H3](https://apimart.ai/model/minimax-h3) · [APIMart H3 Max](https://apimart.ai/model/minimax-h3-max) · [Fal H3 text](https://fal.ai/models/minimax/h3/text-to-video) · [Fal H3 references](https://fal.ai/models/minimax/h3/reference-to-video) · [Fal H3 Max text](https://fal.ai/models/minimax/h3-max/text-to-video) · [Fal H3 Max frames](https://fal.ai/models/minimax/h3-max/image-to-video).

Fal exposes several prompt expansion modes. The APIMart comparison requires evidence that Fal prompt expansion was disabled. The H3 simulator profiles with a Gold quote make this assumption explicit. [Fal H3 image input schema](https://fal.ai/models/minimax/h3/image-to-video/api) · [APIMart H3 generation schema](https://docs.apimart.ai/en/api-reference/videos/minimax-h3/generation) · [APIMart H3 Max generation schema](https://docs.apimart.ai/en/api-reference/videos/minimax-h3/max).

## VideoRouter quote pilot

Run `node scripts/videorouter-estimates.mjs` to preview four synthetic requests offline. Run `node scripts/videorouter-estimates.mjs --estimate` with `VIDEOROUTER_API_KEY` in the local environment to ask for four free quotes. The only network operation in the script is a POST to VideoRouter's pricing estimate endpoint. The script pins the host, disables provider fallback, requires the exact duration and uses public MaxVideoAI demo stills for image references. The JSON keeps the published calculation and the authenticated response separate.

| Model and host | Request | Published estimate in USD |
| --- | --- | ---: |
| Wan 3 Prime · BotSmart | Text, native audio, 15 s, 480p, 16:9 | 0.61039 |
| Wan 3 Standard · BotSmart | One reference image, native audio, 30 s, 480p, 9:16 | 0.67958 |
| Kling V4 · SandBase | Three reference images, 30 s, 720p, 16:9 | 4.10513 |
| MiniMax H3 · Atlas Cloud | Two reference images, 15 s, 480p, 21:9 | 0.58425 |

Published rates were checked on 2026-11-28. These estimates include the 2.5% service fee. The Wan cases explicitly request prompt expansion. The Kling case uses native audio behavior. The H3 case requests the available expansion switch. Confirm that the host preserves Fal's balanced expansion and returns the requested framing before qualifying H3. A quote measures the purchase price offered for a request. Delivery time, media parity and actual billed cost need a separate generation test.

[Pricing estimate](https://videorouter.sh/docs/api-reference) · [Pinned video requests](https://videorouter.sh/docs/video-generation) · [Wan Prime](https://videorouter.sh/video/alibaba/wan-3.0-prime/botsmart) · [Wan Standard](https://videorouter.sh/video/alibaba/wan-3.0/botsmart) · [Kling V4](https://videorouter.sh/video/kuaishou/kling-v4.0/sandbase) · [H3](https://videorouter.sh/video/minimax/h3/atlas-cloud)
