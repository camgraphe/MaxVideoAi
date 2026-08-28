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

---

# GitHub Product Story V2 Design QA

## Evidence

- Source visual truth: `/Users/adrienmillot/.codex/generated_images/01a044d1-b433-75b3-bb24-19fb46ee0e2f/exec-2556e7f9-b176-4a8d-b706-db0de227bbd0.png`.
- Final editorial hero: `/Users/adrienmillot/.codex/generated_images/01a044d1-b433-75b3-bb24-19fb46ee0e2f/exec-b043be47-bf80-4a59-a7d4-9d137e8cb25d.png`.
- Rendered root implementation: `/tmp/maxvideoai-root-readme-render-v2.png` from `http://127.0.0.1:4173/maxvideoai-root-readme-preview.html`.
- Rendered plugin implementation: `/tmp/maxvideoai-plugin-readme-preview.html`, final top capture `/tmp/maxvideoai-plugin-qa-final.png`, and focused captures under `/tmp/maxvideoai-plugin-qa-*.png`.
- Combined comparison input: `/tmp/maxvideoai-design-qa-comparison-v2.png`.
- Focused root evidence: `/tmp/maxvideoai-root-readme-top-v2.png`, `/tmp/maxvideoai-root-qa-middle.png`, `/tmp/maxvideoai-root-qa-proof.png`, `/tmp/maxvideoai-root-qa-scoreboard.png`, `/tmp/maxvideoai-root-qa-architecture.png`, and `/tmp/maxvideoai-root-qa-stack.png`.
- Source pixels: 864 × 1821.
- Implementation pixels: 1280 × 8698 for the complete root README.
- CSS viewport: 1280 × 720 at device density 1 for the focused browser captures.
- Density normalization: the complete source and implementation were compared in two equal-width, independently scrollable columns; focused captures were then reviewed at the implementation's native viewport. The source is a composed GitHub direction while the implementation is native GitHub Markdown, so the comparison targets hierarchy, image rhythm, palette, product sequence, and density rather than impossible pixel identity.
- State: light-theme static GitHub README presentation with current public MaxVideoAI product captures and no authenticated data.

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: the implementation keeps the native GitHub type system for trust and readability. Headings use a clear question-led GEO hierarchy; technical tables and code blocks remain optically distinct from the commercial story.
- Spacing and layout rhythm: the final root README alternates short explanatory passages with eight distinct visual beats before moving into architecture, stack, repository map, setup, and contribution. The focused plugin README starts with assistant value and installation, then alternates product proof with progressively deeper technical material.
- Colors and visual tokens: the dedicated hero matches the selected warm-ivory, charcoal, cool-gray, and restrained cobalt direction. Current product screenshots keep the real MaxVideoAI neutral interface rather than applying a false decorative recolor.
- Image quality and asset fidelity: the hero is a dedicated 1600 × 587 WebP, not a crop of the selected design or a fake UI. Six new product screenshots are current 1268 × 713 production captures with unique hashes; the existing Library proof is used once. No legacy repeated-demo composite remains in either primary README.
- Copy and content: the root README explicitly identifies the web workspace as the main product and the plugin as its assistant extension. Product value precedes engineering depth, while the complete Next.js, React, TypeScript, Tailwind, Supabase Auth, Neon Postgres, S3, Stripe, MCP, testing, and repository-ownership material remains present.
- Accessibility and semantics: every image has descriptive alt text, headings follow a navigable hierarchy, code remains selectable text, and the generated editorial hero is explicitly classified in the asset manifest as brand material rather than product or host proof.

## Full-view Comparison Evidence

The selected direction establishes a cinematic hero followed by discover, compare, price, create, continue, and assistant-workflow chapters. The final native README preserves that order while expanding it with a current model directory, explicit workspace explanation, real pricing proof, Library continuity, and the full engineering half requested by the owner. The GitHub-native column is narrower and more text-forward than the visual mock by design; it remains readable, searchable, copyable, and maintainable in Markdown.

## Focused Region Comparison Evidence

- Hero and opening: `/tmp/maxvideoai-root-readme-top-v2.png` confirms the new cinema-camera hero is visible above the fold and the three tracked destinations remain readable.
- Workspace to examples: `/tmp/maxvideoai-root-qa-middle.png` confirms the main app is presented before the examples gallery.
- Examples to decision support: `/tmp/maxvideoai-root-qa-proof.png` and `/tmp/maxvideoai-root-qa-scoreboard.png` confirm three visibly different example cards lead into the side-by-side scoreboard.
- Product to engineering: `/tmp/maxvideoai-root-qa-architecture.png` and `/tmp/maxvideoai-root-qa-stack.png` confirm the assistant proof transitions into architecture, stack ownership, and repository responsibilities instead of ending at marketing copy.
- Plugin path: `/tmp/maxvideoai-plugin-qa-top.png`, `/tmp/maxvideoai-plugin-qa-install-order.png`, `/tmp/maxvideoai-plugin-qa-guides.png`, and `/tmp/maxvideoai-plugin-qa-technical.png` confirm that Claude, ChatGPT, and Codex stay equal, Codex installation remains copyable, screenshots are varied, and packaging details remain visible.

## Comparison History

### Iteration 1

- [P2] The native README opened with a small logo and current workspace capture but did not carry enough of the selected cinematic visual identity above the fold.
  - Fix: generated a dedicated text-free editorial hero for the exact wide slot, registered it as editorial rather than product proof, and placed the current app capture immediately after a direct workspace definition.
  - Post-fix evidence: `/tmp/maxvideoai-root-readme-top-v2.png` and `/tmp/maxvideoai-design-qa-comparison-v2.png`.
- [P2] The boundary between the MaxVideoAI web product and its GitHub plugin was visually clear later in the page but not explicit enough in the opening sequence.
  - Fix: added `What does the MaxVideoAI workspace bring together?` and stated that the workspace is the main product while the plugin extends the same production path to Claude, ChatGPT, and Codex.
  - Post-fix evidence: the focused top and workspace-to-examples captures show the distinction before the first product proof.

### Iteration 2

- No actionable P0, P1, or P2 differences remained. The final comparison retains the source's cinematic/product-journey intent while respecting GitHub Markdown's native one-column constraints and preserving more technical depth than the mock.

## Technical Verification

- Full repository validation: `pnpm test:validate` passed with 3,727 tests and 0 failures on the final content.
- GitHub content, asset, release-asset, score, acquisition-attribution, plugin-contract, public-bundle, exposure, frontend lint, and patch-hygiene checks passed.
- Deterministic 0.3.2 bundle build included the six new current product screenshots; no tag, release, public-repository sync, or external submission was performed.

## Implementation Checklist

- [x] Dedicated, non-deceptive editorial hero.
- [x] Current app, examples, scoreboard, model directory, pricing, Library, and assistant-workflow proofs.
- [x] No repeated legacy demo composite in either primary README.
- [x] Product-first copy followed by architecture, stack, setup, security, and contribution.
- [x] Equal Claude, ChatGPT, and Codex positioning.
- [x] Manifest provenance, hashes, placements, alt text, and automated visual contracts.

## Follow-up Polish

- [P3] Refresh the public repository social preview only after the README branch is integrated; that asset is outside this local README handoff and must not be published from an unmerged candidate.
- [P3] Re-capture host-native approval or marketplace views when those channels are deliberately published; current product claims do not rely on them.

final result: passed

---

# MCP Inline Video Proof Design QA

## Evidence

- Source visual truth: `/Users/adrienmillot/.codex/generated_images/019f510a-3ce2-72c2-8836-ed267d24d5ec/exec-be36ca23-a3a9-461a-bd1c-f4b32dee5f01.png`
- Rendered implementation: `/Users/adrienmillot/.codex/visualizations/2026/07/11/019f510a-3ce2-72c2-8836-ed267d24d5ec/maxvideoai-claude-inline-video-proof.png`
- Source pixels: 1505 x 1045.
- Implementation pixels and viewport: 1152 x 768 at the Claude desktop app's native capture density.
- Density normalization: none. The source is a broader landing-page art direction while the implementation is host-owned Claude UI; the comparison therefore targets the shared inline-result surface rather than pixel identity of the surrounding frame.
- State: completed MaxVideoAI generation displayed inside a real Claude conversation, with native video controls, result type, exact price, library confirmation, and MaxVideoAI CTA visible.

## Findings

No actionable P0, P1, or P2 findings remain for the requested proof asset.

- Fonts and typography: Claude owns the surrounding type system; the embedded card uses a compact, readable hierarchy consistent with the source intent.
- Spacing and layout rhythm: the real iframe is correctly sized and the complete result surface fits above Claude's composer without clipping the controls, price, library state, or CTA.
- Colors and visual tokens: the embedded card stays neutral and product-aligned, while the completed state and primary action retain clear semantic contrast.
- Image quality and asset fidelity: the screenshot contains an actual generated video frame and native playback controls, not a fabricated UI or placeholder image.
- Copy and content: `Video`, `$0.95`, `Saved to your MaxVideoAI library`, and `Open in MaxVideoAI` explain the outcome and continuation path without technical MCP language.
- Interaction and accessibility: Claude exposes the embedded result as `MaxVideoAI generation result`; Play was activated successfully and changed to Pause, proving real inline playback.

## Full-view Comparison Evidence

The source direction calls for an assistant conversation containing a completed MaxVideoAI video result. The real Claude capture delivers that core proof and adds production evidence the mock could not provide: native playback controls, an actual four-second video, the charged price, persistence in the MaxVideoAI library, and a working continuation CTA.

The surrounding UI is intentionally not pixel-matched because Claude owns it. This is preferable for the marketing proof: it demonstrates the integration in the genuine host rather than presenting another simulated assistant frame.

## Focused Region Comparison Evidence

The inline result card was readable at full-view scale, so no extra crop was needed. Its visible video player, price row, library confirmation, and CTA are the decisive comparison region.

## Comparison History

### Iteration 1

- [P1] Claude created the MCP App iframe but did not display it at a usable height.
  - Fix: implemented the MCP Apps lifecycle (`ui/initialize`, `ui/notifications/initialized`, and `ui/notifications/size-changed`) and live resize reporting.
  - Post-fix evidence: the final Claude capture shows the full interactive video result in the conversation.
- [P2] An earlier capture showed only the top of the video because Claude's composer covered the lower result metadata.
  - Fix: reframed the live conversation so playback controls, price, library message, and CTA are all visible in one capture.
  - Post-fix evidence: `maxvideoai-claude-inline-video-proof.png`.

## Follow-up Polish

- [P3] Replace the staging connector label with the production integration name only when the production connector is deliberately published; the retained proof crop already avoids presenting staging as a production claim.
- ChatGPT host playback remains a separate live-host verification and is not claimed by this Claude proof.

final result: passed
