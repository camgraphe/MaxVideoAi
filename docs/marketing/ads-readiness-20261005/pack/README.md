# Claude Desktop clip — local creative pack

Prepared 5 October 2026. **Local review cuts, not approved for advertising.** Two openings share the same workflow body and setup CTA. The existing watch sample appears in the first frame. The diagrams are visibly illustrative; the separate historical Claude screenshot is dated. No new generation, quote, login or payment was performed.

## Exports

| Opening | 48-second explanatory cut | 24-second short cut |
| --- | --- | --- |
| A · Your project needs a clip | `exports/claude-clip-a-horizontal-review.mp4` · `exports/claude-clip-a-vertical-review.mp4` | `exports/claude-clip-a-horizontal-short24-review.mp4` · `exports/claude-clip-a-vertical-short24-review.mp4` |
| B · The quote first. Your approval next | `exports/claude-clip-b-horizontal-review.mp4` · `exports/claude-clip-b-vertical-review.mp4` | `exports/claude-clip-b-horizontal-short24-review.mp4` · `exports/claude-clip-b-vertical-short24-review.mp4` |

Each video has a matching `.srt` and `.vtt`. They are descriptive English captions for silent video. Core copy and qualifications are already visible in the pictures; the sidecars remain editable and may be enabled separately. They are not a transcript of an invented voiceover.

`exports/thumbnail-a.svg` and `thumbnail-b.svg` are editable 1280 × 720 artwork, with matching PNG exports. `exports/opening-{a,b}-{horizontal,vertical}-poster.png` provides four opening previews. The thumbnails preserve the full source frame with proportional fitting, and reuse the exact MaxVideoAI logo. Keep the companion `assets/` folder with the SVGs so linked images resolve.

The MP4s and temporary rendered scenes are ignored to avoid storing large derivative binaries in Git. They exist in this worktree and can be rebuilt without network access. Versioned source, still previews, captions and manifests make the work reviewable and reproducible. The existing repository MP4 is referenced in place; it is not duplicated in the pack. Transfer the **entire pack plus the referenced source video** when handing it to another editor, or use the optional standalone SVG export below.

## Edit and build

Edit `source/copy.json` for exact copy and the editorial timeline. `source/build.mjs` owns palette, layout, aspect adaptations, image fitting and FFmpeg composition. It produces editable scene SVGs in `source/scenes/`, thumbnails, posters, captions and all eight MP4s. Source SVGs link to the preserved companion assets. The renderer embeds equivalent pixels only in memory to avoid repeated raster copies in Git.

Run from the repository root with Node, the installed frontend Sharp dependency, FFmpeg and FFprobe available:

```sh
node docs/marketing/ads-readiness-20261005/pack/source/build.mjs
node docs/marketing/ads-readiness-20261005/pack/source/verify.mjs
```

For a copy/layout iteration without encoding videos:

```sh
node docs/marketing/ads-readiness-20261005/pack/source/build.mjs --stills-only
```

For portable self-contained scene SVGs in `exports/`, append `--standalone-svg`. That embeds the preserved images and increases file sizes. Fonts remain editable text, not outlines; the current build uses installed Inter with Arial fallback. Recheck text wrapping when changing fonts or editing on another machine. `ADS_FFMPEG` and `ADS_FFPROBE` may set tool paths. No API key or service credential is needed.

## Editorial and release boundaries

- All frames retain **REVIEW CUT** and an evidence label. The 48s version includes a separate historical staging capture; the 24s cut omits it and never implies it shows a current result.
- The 6s watch video is a documented owner-approved September product demo, not a new Claude Desktop recording. Its historical generation cost is documented in the provenance source, never used as a current quote or headline price.
- The brief, connector, quote, approval and job diagrams are designed editorial cards, not redrawn product UI. There is no invented assistant conversation, clickable approval button, live progress counter or new price.
- Normal-speed playback is preserved. The cut explicitly says the generation wait is omitted. No speed or instant-generation claim is made.
- The sole action is **See the Claude Desktop setup** at `https://maxvideoai.com/integrations/claude`. Account, connector and credits are stated. No Claude Code, mobile Claude or universal assistant support claim is made.
- Paid advertising reuse is **not established** by the existing organic marketing approval. `manifest.json` lists rights and evidence gaps. Confirm the watch asset, historical screenshot and incidental third-party marks for the intended paid placement; capture the current exact-host flow before presenting these cuts as current end-to-end proof.
- The dimensions are editorial adaptations, not a declaration of compliance with a selected advertising platform. No platform was selected, no current platform safe-zone check was performed and no campaign was created.

See `storyboard.md` for the edit and fresh capture list, `verification.json` for build properties, and `qa.json` for completed media checks. The coordinator owns the review page. The direct Creative Production board tool was unavailable in this harness; the local exports provide the concrete review surface.
