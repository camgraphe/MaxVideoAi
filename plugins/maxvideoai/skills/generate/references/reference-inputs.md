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

When an asset is absent, prefer `import_reference_files` for user-authorized
host attachments or generated results that expose temporary file handles. It
accepts up to eight files and returns private asset IDs in input order. Keep
successful IDs on a partial batch, retry only failed files, and do not re-list
the library after a successful direct import.

If the host cannot expose a file handle, request a short-lived upload
destination for the correct media kind. A compatible host may render an in-chat
multi-file importer. The browser page is the manual fallback. Codex and Claude
Code may create one destination per local file and run the packaged helper so
the local path never reaches the MCP server. Never publish private references
at a public URL, invent an upload URL, or depend on Computer Use. Re-list only
after the browser fallback; the in-chat importer and helper return usable IDs.
