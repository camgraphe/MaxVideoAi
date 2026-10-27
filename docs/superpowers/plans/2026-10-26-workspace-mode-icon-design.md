# Workspace mode and reference controls — approved A

Owner: UI-MODES-01. Base: `24487e83e` (#537). Delivery follows Kling 4 and is coordinated by Chat de Pilotage; this branch does not authorize a merge or deployment.

## Approved design

Use the A / Hugeicons Stroke Rounded proposal selected by Adrien on 2026-10-26: a compact segmented mode selector, solid active segment, 24px mode icons, and rounded reference commands with 22px icons and explicit add affordances. Preserve the existing warm palette, Geist font, dark theme, translated labels, thumbnails and all reference states. The local reference is `icon-proposals/preview` in this chat's visualization directory, served on port 5187.

## Scope and constraints

- Vendor only the seven selected MIT SVGs from `@hugeicons/core-free-icons@4.3.5`, with attribution; do not change the global AppGlyph or add a runtime dependency.
- Style workspace mode controls and reference commands. Keep default-density Composer rendering intact.
- Preserve mode availability/callbacks, source readiness guards from #537, upload/library/popups, retained assets, required/count/restriction messages, pricing and generation.
- Add marks appear only where adding is available; populated frame thumbnails remain visible.
- Support keyboard focus, disabled states, light/dark and EN/FR/ES at narrow and desktop widths.

## Task 1: implement and verify the approved visual

1. Establish the existing reference/Composer contract and DOM baseline.
2. Add the scoped licensed glyph component; integrate the exact selected icons and CSS.
3. Update the existing icon ownership contract without weakening interaction assertions.
4. Run focused reference/Composer DOM contracts, frontend lint, TypeScript, public exposure and diff checks. No new implementation-mirroring tests for this visual change.
5. Render real production components/CSS in a local browser fixture. Compare with A; inspect desktop/mobile, light/dark, selected/unavailable/upload/error states and popup focus.
6. Obtain one independent branch review, fix material issues, then commit and open an isolated PR. Attach the PR and send pilotage the concrete handoff and evidence. Leave delivery behind Kling 4.

## Review focus

CSS cascade and width pressure with translated labels; shared image/default Composer exposure; disabled versus manage-only reference semantics; retained source-readiness gates; decorative SVG accessibility; exact third-party paths/license. Browser fixture evidence covers presentation and existing tests cover callbacks; it does not claim authenticated full-app or production validation.
