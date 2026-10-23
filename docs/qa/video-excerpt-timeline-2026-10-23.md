# Shared excerpt timeline — local QA, 2026-10-23

This revision replaces the disconnected native sliders with one shared filmstrip
and two gold resize grips. The selected body moves the interval, the upper ruler
seeks, and the contrasting white playhead reports preview position. Zoom to excerpt
zooms the time axis without editing the interval. Compact numeric inputs retain
exact typed values; Whole video returns the exact fractional source endpoint.
The prominent duration uses localized, at most two-decimal presentation.

Scope: existing isolated `codex/marketing-media` worktree. No push, deployment,
production mutation or paid render. Source preparation, original restoration,
ownership, model policies, output duration, price and quote owners are unchanged.
The prior measured phone/minute preparation evidence remains in
`video-excerpt-readiness-2026-10-23.md`; it was not repeated as encoder qualification.

## Automated evidence

- RED: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-excerpt-selector-dom.test.ts`
  failed against the old selector on the requested single-track/interaction and
  optional decoder expectations. Local log: `output/video-excerpt-timeline/red-dom.log`.
- Focused final command: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-excerpt-browser.test.ts tests/video-excerpt-selector-dom.test.ts tests/workspace-video-excerpt-dom.test.ts tests/workspace-pricing-lifecycle-dom.test.ts tests/video-excerpt-persistence.test.ts tests/workspace-assets-hook-contract.test.ts tests/workspace-composer-surface-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts`.
  Result: **97 tests passed, 0 failed**, including both Chromium cases. Local log: `output/video-excerpt-timeline/final-focused.log`.
- Full frontend type checking (exit 0): `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`.
- Scoped lint (exit 0, no warnings) from `frontend/`: `./node_modules/.bin/eslint components/media/VideoExcerptSelector.client.tsx components/media/VideoExcerptTimeline.client.tsx components/media/useVideoExcerptFilmstrip.ts components/media/video-excerpt-styles.ts lib/video-excerpt-copy.ts`.
- `npm run lint:exposure` and `git diff --check`: exit 0.

DOM checks cover exact `5.558333` whole-source Apply, full `60.558333` reset,
invalid oversized/range input, current-model Apply gating, keyboard non-crossing,
dynamic ARIA bounds, movement preserving the precise typed `6.0000001`-second
width across an integer pricing boundary, correct minute carry at `59.999` s,
zoom without edits, pointer/touch
coordinate mapping, paused seeking, localized failures, no eager decoder creation,
optional decoder/canvas failure, source replacement/unmount cancellation, and no
repeated optional capture on Play after failure.

Real Chromium checks cover both shared composer surfaces at 1440/390/320 px,
Apply/Cancel/Escape focus restoration, late Apply versus source/model/account
replacement, and unchanged original-only preview access. A locally generated
60-second `testsrc` fixture exercises ten different decoded frames, one actual
HTMLVideo/canvas capture path, mouse trim, touch seek/trim, keyboard body movement,
zoom/reset, paused scrub, and contained source geometry. Viewports include
1440×1000, 390×667 and 320×568; gestures do not scroll the dialog, actions remain
reachable, and neither page nor dialog overflows horizontally. Opening fetches no
media; range edits are explicit scrub intent and may fetch the owned original.

The synthetic fixture tests the browser capture path; it does not repeat the
server trimming or encoding qualification. Optional capture may be absent for
CORS-restricted previews, unsupported decoders or its bounded deadline. The main
player has no new CORS requirement. No Core Web Vitals improvement is claimed.

## Local visual review

The offline demo at `http://127.0.0.1:3266` uses the real Composer/selector and local
adapters, with the phone MOV (`5.558333` s) and minute source available through its
existing import buttons. Before and revised screenshots are under
`output/video-excerpt-timeline/`; these local files are intentionally not committed.
Portrait source geometry is explicitly bounded inside the stage, preventing an
intrinsic portrait video from extending beyond and being clipped by its container.
Root review checked the full portrait at 1440×1000 and 390×844, handle resizing,
selected-body movement, reset and focus return. `03-desktop.png` and
`03-mobile.png` record the corrected stage. Final phone/minute captures and the
local Apply check are recorded in `root-visual-notes.md` alongside the images.

Touch checks use Chromium emulation. Physical-device VoiceOver/TalkBack behavior
was not certified; exact numeric fields remain the alternate accessible input.


## Fixes found during this revision

The initial focus suite caught duplicate accessible Cancel names on Close and
Cancel; the close icon now has its own localized name. Root visual QA caught an
intrinsic portrait video extending beyond the fixed stage; absolute contained
geometry fixes it. Focused RED regressions also caught rounding a precisely typed
interval down across a 6-second boundary and displaying `00:60.00` near a minute;
movement now quantizes its delta while preserving width, and displayed timecodes
carry rounded centiseconds correctly. The final run above includes these repairs.


Final root visual review used the phone at 1440×1000 and 390×844: full portrait,
ten real thumbnails, a start-handle move from 1 to 1.46 s and a readable localized
3.54-second duration. `04-final-desktop.png` and `04-final-mobile.png` capture the revised phone
controls; the latter shows the moving playhead during loop playback.
For the minute source, root selected 12–18 s and zoomed the ruler to 10.8–19.2 s;
ArrowRight moved it to 12.1–18.1 s without changing its 6-second length, then
ArrowLeft restored it. Explicit Apply produced a measured 6-second owned local
`video-excerpt.mp4`, refreshed the local quote to 6 s / $1.69, and restored focus
to Choose excerpt. `04-minute-zoom.png` and `04-minute-applied.png` show that path.
This was the offline demo's local preparation/quote adapter, with no paid render.

The precision regression additionally verifies selected-body Home/End after a
7-decimal typed offset: the bounds remain exactly 0 and the source end rather
than leaving a sub-centisecond movement remainder.

## Final pointer correction

Task review identified that grabbing a handle away from its center could jump the
endpoint on the first movement. Commit `a27ff5c76` derives the new endpoint from
the initial bound plus raw pointer displacement, then applies the existing
non-crossing/source-bound clamps. Focused mouse and touch regressions failed
before the change and passed after it.

Final covering command:
`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-excerpt-selector-dom.test.ts tests/video-excerpt-browser.test.ts`
passed **35/35**, with no failed or skipped tests. Full frontend TypeScript,
scoped timeline ESLint, and whitespace checks also passed. Broader unchanged
workspace lifecycle evidence remains the 97-test run above; it was not rerun.
Task re-review approved the correction without new findings.

The refreshed final demo and desktop screenshot use this corrected bundle.
`04-final-mobile.png` additionally shows the live playhead within the excerpt.
A nonblocking usability limitation remains for very short selections in full view:
the two 44px handle hit regions can overlap the selected-body pointer target.
Zoom on excerpt and keyboard/numeric controls provide the precise-editing path.

## Completion and review

Independent task review and final aggregate review of
`127dfe95b..a27ff5c76` approve this visual revision with no remaining Critical or
Important findings. The narrow-selection hit-region limitation above remains
nonblocking and is not claimed fixed. The shared backend/model/quote implementation
was not changed or independently requalified by this visual review. Physical-device
assistive technology, required remote CI and production release remain outside
this local qualification.

Design decision: use a single filmstrip timeline beneath the video because
temporal handles drawn on the image could suggest spatial cropping. This is an
authorized continuation of the user's request to improve the existing selector.
If that interaction direction does not suit the user, the rework is confined to
this reversible UI revision; backend, media ownership and pricing remain intact.

The implementation stays on local `codex/marketing-media`; no push, merge,
deployment, paid render or production mutation was performed. The existing
worktree and all unrelated artifacts are retained.
