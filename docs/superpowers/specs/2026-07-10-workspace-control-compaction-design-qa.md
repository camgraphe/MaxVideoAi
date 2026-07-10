# Workspace Control Compaction — Design QA

## 2026-07-10 verification

| Surface | Viewports | Locales | Models | Result |
| --- | --- | --- | --- | --- |
| Generate Video | 320×800, 390×844, 1440×1024 | EN, FR, ES | Seedance 2.0, Kling 3 Pro, Sora 2 | Pass |
| Generate Image | 390×844, 1440×1024 | EN, FR, ES | Nano Banana 2 with a 9:16 result | Pass |
| Preview toolbar | 16:9 and 9:16 | EN | video + image | Pass; center delta 0px |

Verified routes:

- `http://localhost:3000/app?engine=seedance-2-0`
- `http://localhost:3000/app?engine=kling-3-pro`
- `http://localhost:3000/app?engine=sora-2`
- `http://localhost:3000/app/image`

Evidence:

- `output/qa-workspace-compaction/comparison-video-mobile.png`
- `output/qa-workspace-compaction/comparison-image-mobile.png`
- `output/qa-workspace-compaction/comparison-video-desktop-upload.png`
- `output/qa-workspace-compaction/video-sora-mobile-320-final.png`
- `output/qa-workspace-compaction/video-seedance-desktop-grid-viewport-final.png`
- `output/qa-workspace-compaction/image-mobile-390-final.png`

Measured results:

- Engine and Variant share one 42px-high row with an 8px mobile gap and 12px desktop gap.
- At 320px, the final controls end 33px before the 308px layout viewport edge; no control is clipped.
- `documentElement.scrollWidth - documentElement.clientWidth` is `0` on every tested route, viewport, and locale.
- Prompt textareas report `rows="7"` and render at 164px minimum height.
- Seedance desktop renders `Start image`, `End image`, and `Source video` as three equal 268.66px cards on one row.
- Video toolbar width and center match the 16:9 preview exactly.
- The 9:16 image toolbar shares a 0px center delta with the image and uses a 244px one-row action width.
- Resolution and aspect menus open by keyboard with ArrowDown and close with Escape.
- Browser console error check returned no errors.

Technical verification:

- Focused workspace contracts and helpers: 27 tests passed.
- Full validation suite: `pnpm test:validate` exited successfully.
- Frontend lint, exposure lint, and TypeScript checks passed.
- The production Next.js build passed, generated all 709 static pages, and completed sitemap generation.
- `git diff --check` reported no whitespace errors before this report was committed.

The source references use different generated media and, in older captures, still contain Browse. They were used for hierarchy, typography, token, and alignment comparison; the approved compaction specification is the source of truth for Browse removal, seven prompt lines, and the expanded Seedance field set.
