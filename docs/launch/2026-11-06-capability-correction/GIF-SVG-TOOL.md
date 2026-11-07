# Additional GIF / SVG tool

User direction, 6–7 November 2026: these formats belong in an additional tool,
not as secondary controls in the standard image generator. This document records
the concrete design for the previously separate format lot; it is not evidence
of an available or published tool.

## Product

One entry under Tools with two modes: animated GIF and vector SVG. Use a dedicated
workspace with prompt, exact supported model, format-specific settings, a current
quote, explicit confirmation and a downloadable original. The first version
creates one artifact per action. SVG starts with prompt generation; GIF reference
editing can be added only with its owned input contract.

GIF settings: measured pixel dimensions, quality, complexity, 2–16 frames and
frame delay. SVG settings: image model, reference-image quality/complexity and
background. Do not invent a model-author default or expose its optional selector
without account qualification.

## Execution and cost ownership

Reuse existing toolbox-session identity, canonical quote/reservation, owned media,
immutable payment, idempotent confirmation and recovery primitives. Add a separate
OpenAI artifact adapter and result owner instead of weakening the raster parser.
Account GIF preview access is required per model. SVG responses include
`svg_usage` for the authoring model in addition to image usage; the existing raster
cost reader cannot price the whole SVG request. Do not apply the existing Creator
×2.20 policy or a guessed GIF frame multiplier without a concrete commercial review.

Source: [Images API reference](https://developers.openai.com/api/reference/resources/images/methods/generate),
[GIF guide](https://developers.openai.com/api/docs/guides/image-generation#generate-animated-gif-output),
[2.6 guide](https://developers.openai.com/api/docs/guides/image-prompting#gpt-image-2.6-guide).

## Artifacts

Keep original bytes separate from safe previews. Inspect GIF signature, dimensions,
frames, actual delays and looping; preserve animation and create a static thumbnail.
Validate SVG XML with bounded dimensions/complexity and no executable content,
external resources, entities or foreignObject. Render a server-side raster preview
and serve the original SVG through a controlled download; do not insert generated
XML into the application DOM. The original and preview have separate MIME, URL
and ownership facts.

## Qualification before publishing

Establish exact per-model GIF access, supported size/frame combinations, complete
usage/cost basis, and SVG author identity/usage. Prepare concrete customer quotes
and bounded paid qualification requests for approval. Test malicious/malformed SVG,
GIF metadata preservation, partial/ambiguous outputs, storage recovery without
another POST and exactly-once refunds. No paid tool test or production activation
was authorized or performed by this design document.
