# MiniMax H3 launch contract

Checked against the live first-party MiniMax and Fal pages on 2026-08-08.

## Sources

- <https://fal.ai/minimax-h3>
- <https://fal.ai/models/minimax/h3/text-to-video/api>
- <https://fal.ai/models/minimax/h3/image-to-video/api>
- <https://fal.ai/models/minimax/h3/reference-to-video/api>
- <https://minimaxi.com/blog/minimax-h3>

## Provider endpoints and fields

| MaxVideoAI mode | Fal endpoint | Provider fields |
| --- | --- | --- |
| `t2v` | `minimax/h3/text-to-video` | `prompt`, `duration`, `resolution`, `aspect_ratio` |
| `i2v` | `minimax/h3/image-to-video` | `prompt`, `duration`, `resolution`, `image_url`, optional `end_image_url` |
| `ref2v` | `minimax/h3/reference-to-video` | `prompt`, `duration`, `resolution`, `aspect_ratio`, `reference_image_urls`, `reference_video_urls`, `reference_audio_urls` |

The product uses one canonical `minimax-h3` engine. Endpoint selection is an
internal projection of the selected mode, not a separate public model.

## Live input contract

- Prompt: required, up to 7,000 characters.
- Duration: every integer second from 5 through 15; Fal's examples default to 10 seconds.
- Frame rate: 24 FPS.
- Resolution: `768P`, `2K`, or `4K`; MaxVideoAI defaults to `2K`.
- Text/reference aspect ratio: `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, or provider value `adaptive`. MaxVideoAI labels `adaptive` as `Auto`.
- Image-to-video follows the source image and does not send `aspect_ratio`.
- Image-to-video requires `image_url` and accepts one optional `end_image_url`.
- Reference-to-video accepts up to 9 images, 3 videos, and 3 audio clips, with at most 12 unique references in total.
- Each reference video is 2–15 seconds and all reference videos together are limited to 15 seconds.
- Each reference audio clip is 2–15 seconds and all reference audio together is limited to 15 seconds.
- Audio references must accompany at least one reference image or video. Video-only reference input is supported.
- H3 generates native stereo audio. There is no `audio` or `generate_audio` request toggle.
- MaxVideoAI's compatible upload set is JPEG/PNG/WEBP images, MP4/MOV video, and MP3/WAV audio. Local validation also enforces Fal's 30 MB image, 50 MB video, and 15 MB audio limits.

## Provider cost facts

| Resolution | Fal rate |
| --- | ---: |
| `768P` | USD 0.08 per output second |
| `2K` | USD 0.13 per output second |
| `4K` | USD 0.16 per output second |

The first five reference images are included. Each reference image after the
fifth adds USD 0.08. Customer pricing remains owned by the canonical MaxVideoAI
pricing layer; these values are provider inputs, not authored public totals.

## Product and content facts

MiniMax announced H3 on 2026-07-31. The launch describes one multimodal model
for text, images, video, and audio context, with native stereo sound,
multi-shot sequencing, prompt adherence, text rendering, character
consistency, and motion transfer. Public copy must not claim that every source
modality is available in every endpoint; the three endpoint contracts above
remain authoritative.

## Release rule

Re-check these five live sources immediately before either paid marketing
request and again before production deployment. If an endpoint, field, limit,
or rate changes, update this document, implementation, and contract tests
before spending or deploying.
