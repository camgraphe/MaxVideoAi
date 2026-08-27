# Generation reference inputs

Load this reference after the model and mode are selected and the request uses
an image, video, or audio reference.

Always read the selected live mode details. Follow its canonical reference
roles, media kinds, counts, size limits, and combined duration limits. If it
reports `assetRequired: true`, or its `assetRequiredWhen` condition matches the
chosen settings, select a private MaxVideoAI asset. Do not infer requirements
from a familiar mode name.

- `t2v` is text to video and normally has no media source.
- `i2v` uses a first or start image and may accept a last or end frame.
- `i2v_standard` is a distinct image-to-video route, not image editing. Treat
  its price as live data from the current quote, not as a permanent tier.
- `ref2v` uses only the supported image, video, and audio reference types.
- `fl2v` requires first and last frame images in their canonical roles.
- `v2v` uses a source video plus any supported image or audio references.
- `r2v` preserves the user's authored order for reference videos.
- `extend` preserves the user's authored order for source clips.
- `a2v` follows verified source audio.
- `retake` replaces a selected part of a verified source clip.
- `reframe` changes the canvas of a verified source clip.

For GPT Image edits, use only the returned image roles such as `source`,
`reference`, or `mask`. When the live resolution is `custom`, send both image
dimensions. For `auto`, use a private owned reference so dimensions can be
verified before quoting.

When an asset is absent, request a browser upload destination for the correct
media kind. Wait for the user to finish, re-list that kind, and let them select
the asset. Never invent an upload URL or claim the browser step completed.
