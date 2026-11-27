# Admin video purchase comparisons

The admin simulator includes these additional supplier quotes, checked on 2026-11-27. Each comparison-only candidate carries its rate source. Console prices are published estimates in USD. The paid dispatch path and the historical Wan replay continue using the offer set in the purchase router.

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
