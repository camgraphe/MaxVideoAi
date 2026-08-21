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

## Production marketing run

The initial launch run on 2026-08-08 used exactly two paid H3 requests. A
third paid text-to-video request was added later that day at the product
owner's explicit request so the model page could use two different playable
videos. All scenes are character-led narrative films; none contains a product
packshot. Deterministic local keys prevented accidental resubmission after
client timeouts.

### Accepted model-page render

- Job: `job_91c6f549-7b07-45b3-ad45-cbaf67d10959`
- Provider request: `019fe1e3-09f9-7f01-a2de-51ba4263ea35`
- Configuration: text-to-video, 15 seconds, 2K, requested 16:9, 24 FPS,
  native stereo audio.
- Prompt: Elara, an original lighthouse keeper in a weathered mustard
  raincoat, races through a storm, climbs the tower, powers the Fresnel lens,
  says “Harbor light is alive. Bring them home.”, and guides a distant
  lifeboat to safety. The prompt assigns timing, action, camera and sound to
  four consecutive shots and explicitly excludes music, text, logos,
  watermarks and product framing.
- Durable video:
  <https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a9be1c27-72e5-42ab-9bc7-ea14de67ea8d.mp4>
- Durable thumbnail:
  <https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0807dc6f-ef8a-4bd1-bc27-d5e931767d81.jpg>
- Media QA: H.264 at 2544×1456, 24 FPS, 15.083 seconds, two-channel AAC;
  no detected black, frozen or silent segment. The stereo channels carry a
  measurable difference signal. Visual review accepted character identity,
  story progression and the final lighthouse-beam reveal.

The model-page launch artwork at
`frontend/public/models/minimax-h3-launch.jpg` is a frame selected from this
accepted production render. The localized prompt lab reproduces the complete
production direction and the requested 15-second settings.

### Reference-workflow validation render

- Job: `job_4c6c44f9-7c90-4185-99eb-376f6cb514bd`
- Provider request: `019fe1e4-aa8f-7d32-8470-c8b2c0d5c3ae`
- Configuration: reference-to-video, 15 seconds, 4K, 16:9, 24 FPS, two
  character images and one 15-second stereo audio reference.
- Prompt: Mara and Tomas meet on a rain-soaked European railway platform,
  exchange a hand-drawn map, hear “Final service now arriving on platform
  two.”, and board the last train. The prompt locks both identities, wardrobe,
  props, shot timing and station sound while excluding music, text, logos,
  watermarks and product framing.
- Fal completed the request, but the returned CDN object did not provide a
  readable byte during launch QA. The job remains private and in durable-copy
  processing; it is not part of the model page, playlists or video sitemap.
  No third paid request was made during the initial launch run.

### Accepted model-page hero render

- Job: `job_87d713f7-9193-4831-a9e5-59ce1e0c668c`
- Provider request: `019fe299-7ca1-7e33-9d92-c1a75f6015e3`
- Configuration: text-to-video, 15 seconds, 2K, requested 16:9, 24 FPS,
  native stereo audio.
- Prompt: Lio, an original wildfire lookout in a rust-red field jacket, sees
  stranded hikers from a mountain tower, descends wet stairs, builds a red
  flare corridor, says “Trail three, follow the red lights. I'm coming
  down.”, and runs toward the group. Four consecutive shots specify identity,
  action, camera, geography and sound while excluding music, subtitles, text,
  logos, watermarks, beauty-ad framing and product packshots.
- Durable video:
  <https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/ee88f1fa-7d90-4b1d-b6d0-8373eea6c726.mp4>
- Durable thumbnail:
  <https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/1a5ea6c8-1d4e-4675-bc10-6e91abd3fd99.jpg>
- Media QA: H.264 at 2544×1456, 24 FPS, 15.083 seconds, two-channel AAC;
  no detected black, frozen or silent segment. The stereo difference channel
  is active. Visual review accepted the consistent lookout, tower-to-trail
  progression, flare corridor and final rescue reveal.
- Publication: public and indexable in `examples`, `examples-minimax-h3` and
  `family-hailuo`, with an approved canonical watch page at
  `/video/minimax-h3-wildfire-lookout-rescue`.

The model page pins this wildfire rescue as the hero and keeps the accepted
lighthouse render as the separate prompt-lab demo. The paid H3 request count
for the completed launch and model-page correction is therefore three.

### Owned reference assets

The reference images were generated with OpenAI image generation from
original-character briefs, then used only as H3 inputs:

- `frontend/public/assets/model-examples/minimax-h3/reference/cartographer-one.png`:
  Mara, an original adult cartographer with medium-brown skin, short black
  curls, an olive raincoat and a brass compass; neutral full-body reference,
  realistic anatomy, no text or logo.
- `frontend/public/assets/model-examples/minimax-h3/reference/cartographer-two.png`:
  Tomas, an original freckled auburn-haired adult cartographer in a navy coat
  and gray scarf carrying a tan map tube; neutral full-body reference,
  realistic anatomy, no text or logo.
- `frontend/public/assets/model-examples/minimax-h3/reference/station-ambience.wav`:
  a locally authored 15-second, 48 kHz stereo bed with rain, rail ambience,
  braking sound and the synthetic station announcement used in the prompt.
