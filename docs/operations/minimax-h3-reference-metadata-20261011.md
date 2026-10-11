# MiniMax H3 MCP video reference rejection — 2026-10-11

## Evidence and cause

An imported H.264/yuv420p MP4, 720×1280, 14 seconds, about 3.49 MB,
without audio, was rejected by `prepare_generation` for `minimax-h3/ref2v`.
Both 24 and 30 fps variants failed, with or without a PNG reference.
The same 30 fps video and image reached a Wan 3 quote. H3 settings were
14 seconds, 2K, 9:16, 24 output fps, with prompt expansion disabled.
The returned error was `REFERENCE_INVALID`, non-retryable, with only
“The reference media is invalid for this model mode.”

The import helper and direct-upload completion call the shared
`storeVideoUpload` owner. Native host imports also use that owner. Its
`probeMediaBuffer` read duration, container and audio presence, but did not
request video dimensions from ffprobe. The storage service explicitly wrote
null dimensions into `user_assets`, omitted them from the canonical
`ensureReusableAsset` call, and returned null dimensions.

`resolveOwnedReferenceAssetForActor` correctly kept those unknown dimensions.
H3's `ownedAssetModes` validation then rejected the reference because width
and height were missing. Wan's different model checks explain why its quote
could succeed. The reference geometry was lost at import, before model
validation; portrait format and input frame rate were not the cause.

The generic public mapping of `GenerationCapabilityError` concealed which
constraint failed. No provider call is needed to reproduce this failure.
Production database rows were not queried or changed during this investigation.
Private receipts, identifiers, URLs, filenames and media were not copied into
the repository; the source evidence was read in place.

## Correction and regression evidence

- The existing bounded upload probe now measures width and height from the
  first non-cover-art video stream. Only positive safe integers are retained.
- Storage carries the measurements through both asset projections, the upload
  result and probe facts. Audio keeps null dimensions.
- Validation still rejects missing dimensions, unsupported formats, oversized
  files, invalid durations, excessive combined durations and invalid image
  aspect ratios. Fixed public messages identify the failing constraint and the
  corrective action without returning private metadata or provider field names.
- A real local FFmpeg fixture reproduces the 14-second portrait H.264 video at
  both 24 and 30 fps. Real probe, storage orchestration, owned-asset resolution
  and quote validation run against offline I/O boundaries. Video-only and
  video-plus-image cases pass for H3 and Wan after the fix. Before the fix,
  the fixture passed Wan and failed H3 with the observed error.
- Negative quote tests assert rejection before pricing or quote persistence,
  useful messages and absence of private data. Probe tests exclude attached
  album art and invalid dimensions.

Local validation on 2026-10-11:

| Check | Result |
| --- | --- |
| New MP4 regression, probe facts, preparation and upload handoff suites | 60 passed |
| Import, direct upload, ownership, reference generation, provider parity, H3 constraints and special modes | 96 passed |
| `pnpm mcp:client:check` | 153 passed; one authoring-validator test skipped because that optional tooling is not installed; deterministic tool-selection check passed |
| Validation-runner and shared media architecture contracts | 9 passed |
| Packaged local-helper contracts | 4 passed |
| Frontend lint and public-exposure lint | Passed |
| Source-only frontend TypeScript check | Passed, inheriting the repository configuration and excluding stale `.next` generated validators |

The normal frontend TypeScript command encountered three stale `.next/types`
imports of an absent marketing blog layout. That layout is absent from the
starting Git commit too; no generated Next files were deleted or edited for
this task. The isolated check used a temporary configuration outside the
repository, with incremental output disabled. A full production build and the complete repository suite were not
run. These local checks do not replace the required Quality CI before merging.

## Delivery and recovery limits

This is a source correction, not a production deployment or a paid-provider
certification. No generation was submitted and no live account was changed.
Existing imports remain unchanged until they are re-imported after delivery or
an independently reviewed, bounded metadata repair runs. The canonical upload
upsert already fills missing dimensions for the same owned source.

The fix does not relax ownership or model limits, accept caller-supplied
dimensions, convert the source media, or alter the provider's output settings.
After normal reviewed delivery, re-import the original and prepare a fresh
quote. A successful quote still requires explicit approval before generation.
