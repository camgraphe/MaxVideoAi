# Workspace Control Compaction Design QA

## Evidence

- Source visual truth:
  - `output/playwright/comparison/video-mobile-engine-viewer-source.png`
  - `output/playwright/comparison/image-mobile-engine-viewer-source.png`
  - `output/playwright/comparison/video-desktop-upload-source.png`
  - `docs/superpowers/specs/2026-07-10-workspace-control-compaction-design.md`
- Browser-rendered implementation:
  - `output/qa-workspace-compaction/video-sora-mobile-320-final.png`
  - `output/qa-workspace-compaction/video-seedance-mobile-390.png`
  - `output/qa-workspace-compaction/image-mobile-390-final.png`
  - `output/qa-workspace-compaction/video-seedance-desktop-grid-viewport-final.png`
  - Live Browser capture at 1463×1074 after the final quantity and guest-duration fixes (Generate action and asset grid focused states).
- Full-view/focused comparisons:
  - `output/qa-workspace-compaction/comparison-video-mobile.png`
  - `output/qa-workspace-compaction/comparison-image-mobile.png`
  - `output/qa-workspace-compaction/comparison-video-desktop-upload.png`
- Viewports: 320×800, 390×844, 1440×1024.
- States: empty video preview, ready 9:16 image preview, EN/FR/ES, Seedance/Kling/Sora, guest/member-priced generation controls.

## Findings

No actionable P0, P1, or P2 findings remain.

Required fidelity surfaces:

- Fonts and typography: existing font families, weights, micro-label tracking, and hierarchy are unchanged. Prompt copy uses the existing 14px/20px workspace treatment and now exposes seven complete lines. Engine and localized control text truncates without escaping its trigger.
- Spacing and layout rhythm: Engine and Variant share one 42px row with 8px mobile and 12px desktop spacing. Settings use 36px triggers and compact gaps. Seedance's first three cards are equal and share one desktop row.
- Colors and visual tokens: existing border, surface, text, focus-ring, disabled, and brand tokens remain in use; no new palette or decorative treatment was introduced.
- Image quality and asset fidelity: real generated media remains `object-contain`; no imagery, logo, or icon was replaced. The 9:16 image remains uncropped and centered.
- Copy and content: Browse is absent only from workspace presentation. EN, FR, and ES dictionaries remain active. Resolution labels are concise while submitted values remain unchanged.
- Icons and affordances: redundant compact-control chevrons and decorative resolution/count icons are removed; useful media/action icons, focus states, accessible names, and listbox semantics remain.
- Responsiveness and accessibility: no document overflow was measured. Controls stay visible at 320px. Prompt `rows="7"`, keyboard ArrowDown/Escape behavior, focus ownership, and disabled explanations were verified.

## Comparison History

### Iteration 1

- [P2] Desktop Variant was aligned to the far right instead of grouped with Engine.
  - Fix: bounded the desktop Engine wrapper to 320px while keeping it flexible on mobile.
  - Post-fix evidence: desktop Engine ends at x=553, Variant starts at x=565; gap is 12px.
- [P2] Seedance ordered Source video before End image.
  - Fix: introduced a Seedance-specific pure asset-field rank: Start image, End image, Source video, then reference collections.
  - Post-fix evidence: `video-seedance-desktop-grid-viewport-final.png`.

### Iteration 2

- [P1] At 320px the Variant control extended 12px past the visible workspace edge.
  - Fix: constrained the workspace EngineSelect flex owner, reduced the mobile Variant width to 92px, and used an 8px mobile gap.
  - Post-fix evidence: `video-sora-mobile-320-final.png`; right inset is 33px and document overflow is 0px.
- [P2] A portrait image forced five preview actions into a 126px, three-row toolbar.
  - Fix: retained the media center axis but allowed the image toolbar a parent-bounded 244px minimum action width.
  - Post-fix evidence: `image-mobile-390-final.png`; toolbar height is 38px and center delta is 0px.

### Iteration 3 — browser annotation follow-up

- [P2] The compact resolution value had lost its useful icon and rich SelectMenu labels sat 2px above the trigger center.
  - Fix: restored the resolution icon for video and image workspaces, normalized compact label line-height, and made SelectMenu trigger/option label wrappers flex-centered.
  - Post-fix measurement: the 720p trigger, resolution icon, and label share the exact same vertical center; the image workspace 1K control reports the same 0px center delta.
- [P2] Seedance upload-card guidance, add actions, and remaining-slot copy used content-driven vertical positions.
  - Fix: reserved 32px guidance and footer zones and let the add-action zone consume the shared flexible middle row.
  - Post-fix measurement: all six empty Seedance cards use 32px information and footer zones; the three add actions on each row share the same center coordinate.

### Iteration 4 — control-row inset

- [P2] The first compact setting control sat against the prompt footer border.
  - Fix: added a workspace-only 12px left inset while preserving the zero right inset and Generate position.
  - Post-fix measurement: footer-to-first-control gap is 12px; footer-to-Generate right gap remains 0px.

### Iteration 5 — mobile intrinsic control widths

- [P2] Compact controls still reserved a 96px mobile minimum after their chevrons were removed.
  - Fix: removed the mobile-only minimum width from video and image settings while retaining non-shrinking intrinsic controls inside the local scroller.
  - Post-fix measurement: computed minimum width is 0px; 8s is 62px, 720p is 78px, and 16:9 is 73px, matching desktop intrinsic sizing.

### Iteration 6 — dropdown readability

- [P2] Portaled setting menus calculated a wider content width but still applied the compact trigger width, making duration choices difficult to scan.
  - Fix: applied the calculated menu width, added a viewport-bounded 128px portal minimum, and standardized thin low-contrast scrollbars for SelectMenu lists.
  - Post-fix measurement: the duration trigger remains 62px while its menu is 128px; the list reports `scrollbar-width: thin` and a 45% slate scrollbar color.

### Iteration 7 — generate action alignment

- [P2] The workspace footer used a 12px left inset but no right inset, leaving the Generate action flush against the prompt edge.
  - Fix: applied the same 12px horizontal inset to the settings row and Generate action on video and image workspaces.
  - Post-fix measurement: the settings row begins 12px from the footer edge and the Generate action ends 12px from the opposite edge.

### Iteration 8 — quantity action grouping

- [P2] The iteration count was visually grouped with media settings even though it changes the cost and number of outputs for the primary action.
  - Fix: moved the video iteration count and image output count into a dark secondary action immediately before Generate.
  - Post-fix measurement: quantity and Generate controls share a 44px height, an 8px gap, and one baseline on both generation workspaces.

### Iteration 9 — example settings continuity

- [P1] A guest example supplied a new duration but no explicit duration option, so the previous duration option could remain selected.
  - Fix: when a recalled example supplies a duration, use it as the duration option input before engine-specific normalization.
  - Post-fix evidence: the regression pipeline now resolves an 8s form followed by a 12s guest sample to 12s; a connected 15s sample applied 15s, 720p, 9:16, audio on, and its prompt in Browser QA.

## Primary Interactions Tested

- Engine and variant rendering across Seedance, Kling, and Sora.
- Compact resolution/aspect listbox opening with ArrowDown and closing with Escape.
- Quantity listbox opening beside Generate with 1x, 2x, 3x, and 4x options.
- Connected example recall from 5s to 15s, including resolution, ratio, audio, and prompt continuity.
- Guest example duration recall through the no-auth payload and engine-normalization regression path.
- Generate price remains visible once in EN, FR, and ES.
- Image preview actions remain enabled for a ready result and aligned under 9:16 media.
- Browser console errors checked: none.

## Technical Verification

- Focused workspace contracts and helper tests: passed (27 tests).
- Full project validation suite: `pnpm test:validate` passed with exit code 0.
- Final project validation suite passed with 0 failures after the guest-duration regression test was added.
- Frontend lint: `npm --prefix frontend run lint` passed.
- Exposure lint: `npm run lint:exposure` passed.
- TypeScript: `pnpm --prefix frontend exec tsc --noEmit` passed.
- Production build: `pnpm --prefix frontend run build` passed, including 709 static pages and sitemap generation.
- Patch hygiene: `git diff --check` passed before the QA report commit.

## Residual Test Gaps

- The browser session contained 16:9 video and 9:16 image evidence; square image geometry is covered by the shared aspect-ratio calculation and contracts but was not present as a live ready result during this pass.
- Source visual captures contain older media and the superseded Browse row, so exact pixel comparison is limited to stable hierarchy, spacing, typography, and control treatment.

final result: passed
