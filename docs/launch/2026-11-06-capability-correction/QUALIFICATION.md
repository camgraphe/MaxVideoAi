# GPT Image 2.6 high-resolution qualification

Completed in production on 7 November 2026 through the native MCP quote and
confirmation flow at USD 0.17 per successful image. The first Flare attempt was
rejected and refunded; a fresh exact quote and explicit user approval authorized
its replacement. Sunburst used its original approved single attempt. No automatic
retry occurred. Originals are saved in the connected library and visually reviewed
as marketing candidates; existing public heroes were not replaced.

| Request | Model | Mode | Pixels | Quality / complexity | Output | Proposed retail |
| --- | --- | --- | --- | --- | --- | --- |
| Last departure | GPT Image 2.6 Flare | t2i | 3840×2160 | high / high | one opaque PNG | USD 0.17 |
| The horn at dawn | GPT Image 2.6 Sunburst | t2i | 2160×3840 | high / high | one opaque PNG | USD 0.17 |

The proposed total is USD 0.34 under the previously approved commercial formula.
Both use 3,336 estimated image-output tokens: USD 0.10008 output list cost,
plus USD 0.01 commercial input reserve, multiplied by 1.50 and rounded upward.
The input reserve is not a provider cost ceiling. Provider text-input charges
remain additional; inspect actual returned usage without claiming an invoice.

## Observed production results

| Result | Job | Decoded original | Customer charge | Provider usage |
| --- | --- | --- | ---: | --- |
| Flare, Last departure | `5a639095-8f4b-42ac-934a-d61ebbc2c639` | PNG RGB, 3840×2160, 13,055,005 bytes | $0.17 | 226 text input + 3,337 output tokens |
| Sunburst, The horn at dawn | `902234de-9a1c-45a0-8510-5f6e2d89f1d4` | PNG RGB, 2160×3840, 13,089,715 bytes | $0.17 | 238 text input + 3,336 output tokens |

Both jobs are `completed` and `paid_wallet`, with one stored output, a durable
thumbnail and one completed provider request each. PNG IHDR dimensions, public
HTTP Range responses and browser decoding agree. Visual review confirms the
requested cinematic composition, crowds and foreground human action in both
orientations. These observations qualify these two raster cases, not every
possible size, quality, edit or automatic-setting combination.

The failed Flare job `29d528b4-8894-48c9-a12d-9dbc66a8c17a` charged and refunded
17 cents. The final wallet moved from 5,180 to 5,146 cents, with no pending hold:
34 cents net for the two successful images. Provider list-cost estimates from
returned usage are $0.10124 and $0.10127 respectively; neither is an invoice.

### Authentication diagnosis and correction

The production key was valid but restricted to model discovery, Responses and
Chat Completions. A non-generative empty-payload request established the precise
401 reason: missing `api.model.images.request`. This was not evidence that Milo
or the whole OpenAI account was unavailable. Ten assistance calls in the preceding
24 hours were settled; the five prompt-assistance requests were complete with
zero authentication errors. Non-generative checks also passed authentication for
the Responses input-token and Chat Completions endpoints.

The user explicitly approved adding only the Images request permission to the
existing key. No key was rotated or copied. After propagation, the same empty
Images payload reached ordinary missing-model validation instead of 401; the two
authorized production generations then succeeded. Local provider qualification
and an environment-variable presence check alone had not established the deployed
key's endpoint permissions. Future launch checks must verify the actual production
credential's required scope without logging it or creating unapproved media.

## Last departure

Create one original photorealistic cinematic film still in a very wide 16:9 composition. At a colossal orbital departure terminal, hundreds of adults in worn work clothes stream toward the last grounded evacuation shuttle. In the foreground an exhausted female flight officer in a burnt-orange uniform hauls a stumbling mechanic to his feet while urgently signaling the crowd onward; both faces and their interacting hands are clear. Behind them two rescue crews push a heavy equipment trolley through billowing dust. Beyond a closing armored hangar door, an enormous fractured moon fills the black sky. The evacuation has a clear direction from the lower left foreground toward the luminous shuttle ramp on the right. Human urgency, readable silhouettes, convincing weight and scale, practical amber floodlights against cold blue emergency lighting, rich restrained color, tactile matte painted metal and fabric, subtle 35mm film grain. A believable frame from an ambitious original science-fiction film, not concept art, not a poster or collage. No mirrors, glass walls, transparent props, glossy reflections, floating captions, logos or watermarks. Render at 3840x2160.

## The horn at dawn

Create one original photorealistic cinematic film still in a tall 9:16 composition. At dawn beneath the towering stone gate of an ancient mountain city, a scarred female cavalry commander in weathered bronze armor raises a signal horn while pulling a frightened young adult courier behind a massive wooden barricade. In the lower foreground, soldiers and civilian volunteers brace the barricade together; in the middle distance, a crowd of refugees climbs the steep street toward safety. Above them, on several levels of the immense city wall, hundreds of defenders unfurl deep red standards as the first sunlight cuts through dense airborne dust. A coherent dramatic instant: the last civilians have reached the gate and the defenders are closing it. Strong vertical depth, clear faces and expressive hands, authentic heavy materials, beautiful warm dawn light and deep cool stone shadows, natural skin texture, subtle large-format cinema grain. Epic scale grounded in human action. A frame from an ambitious original historical adventure film, not a poster, collage or illustration. Opaque matte surfaces; no mirrors, glass, transparent objects, reflective armor, lettering, logos or watermarks. Render at 2160x3840.

## Acceptance

Verify decoded original dimensions and format, visible composition, output count,
one accepted provider request, usage capture, durable library original/thumbnail,
App/MCP status parity and unchanged paid identity. A rejected or ambiguous request
is investigated without an automatic resubmission.
