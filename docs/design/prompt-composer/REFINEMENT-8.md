# Refinement 8 — shared creation and gallery navigation

2026-10-28. Adrien asked to bring Video / Image / Audio back above the workspace and align Activity / Recents on the same row, with lighter controls. This replaces the sidebar creation links experiment; the prior state remains available at `8f9acbf34` on the same PR history.

## Layout and ownership

The preview uses one sticky 45 px row below the app header. Creation links sit above the main column; Activity / Recents sit above the gallery, using its existing responsive widths (240 / 272 / 320 px). Both groups use text, a fine active underline and 44 px targets. The boxed gallery switch is removed from the rail. The sidebar and mobile bottom navigation return to the normal Create entry.

`AppCreationContent` owns the shared row and an optional gallery-navigation slot. `WorkspaceChrome` forwards that slot. `WorkspaceAppShell` retains view state, lazy recent-media loading, panel ownership and existing callbacks. Image and audio reuse the top creation navigation without receiving video gallery state. Production retains the original presentation through the existing development-only preview flag.

Below 768 px the gallery has no adjacent column, so its desktop switch is hidden. The existing Activity / Recents heading actions remain available as lighter text buttons, preserving the mobile drawer and focus return. The creation links stay visible above the page on all widths. No player geometry, gallery cards, scrolling containment, prompt, pricing or generation behavior changes.

This gives the page a shared visual heading rather than promising a shorter central editor: the new row adds 45 px above the player, while replacing the previous 54 px gallery switch block. At the authenticated desktop viewport, the navigation's right section and gallery both begin at x=839 and measure 320 px wide.

## Validation

- 13 targeted navigation, shell contract and command-bar tests pass. The browser case covers 320 / 390 / 768 / 1440 px, one compact media-navigation row, desktop alignment, responsive gallery controls, route switching, composer operations, Expand, model access and production-off behavior. Its fixture now includes the actual header-height reservation for sticky positioning.
- TypeScript, focused ESLint and diff checks pass.
- In the authenticated app, Activity → Recents → Activity works. At 390 px, Recents opens and closes, focus returns to its opener, and there is no horizontal overflow. The viewport override is reset afterward.
- Private screenshots: `shared-creation-gallery-topbar.png` and `shared-topbar-mobile.png` in the task visualization folder. No generation or LLM call was made.

The work remains isolated in draft PR #555; no production deployment.

## Follow-up — stable initial writing height

Before the first message, AI assistant matches the manual writing area's measured height. The measurement follows the visible manual editor, including a user's textarea resize. Both modes reserve the same footer width for model, variants, references and the send-action column, so switching tabs does not change reference wrapping or move the generation toolbar. Narrow model names truncate while Variant remains beside the model. The bounded history still opens only after the first send.

The authenticated Modify view measures 326 px in both modes, with the toolbar at the same document position (913.24 px). Targeted browser checks compare the initial frame, model and toolbar geometry at 320 / 390 / 768 / 1440 px, plus required-source positions in Modify and Extend. Private captures: `stable-idle-prompt.png` and `stable-idle-assistant.png`.

## Follow-up — source guidance below generation

In the composer preview, the source-upload and pricing guidance now appears below the generation toolbar. Its original header wrapper is hidden when it has no other notice, so Create / Modify / Extend share the same top position for the writing frame. The Required badge remains beside the source button. Upload, excerpt and pricing states continue to use the existing notice component; production presentation is unchanged.

The browser regression checks assert the same frame top and exactly one guidance notice below Generate at 320 / 390 / 1440 px, in both writing tabs. All 41 targeted layout, architecture, Modify and Extend checks pass, along with TypeScript, focused ESLint and diff checks. In the authenticated app, all three operations place the frame at document y=528.99 px; the Modify / Extend guidance starts 8 px below the toolbar. Private capture: `source-guidance-below-generate.png`. No generation or LLM call was made.

## Follow-up — one gallery heading

The desktop preview removes the redundant Latest renders / View all row from the activity rail. View all sits at the right edge of the shared Activity / Recents navigation and links to `/app/library` in either tab. The gallery retains an accessible region label. On mobile, where that shared navigation is hidden, the existing gallery heading keeps the same Media destination. Other gallery callers and production retain their existing header.

Gallery props and feed-state types now live in `gallery-rail-types.ts`, re-exported from the original component, keeping the shared orchestrator below its 500-line contract. Eighteen focused navigation, gallery and shell checks pass, including the new right-edge alignment assertion at desktop breakpoints; TypeScript, focused ESLint and diff checks pass. Live checks at 768 and 390 px confirm the desktop header disappears, View all remains available and the link targets Media; Activity / Recents switching works at the normal viewport. Private capture: `gallery-header-view-all.png`.

## Follow-up — clearer creation-mode affordance

Video / Image / Audio now use 13 px medium text and 18 px icons, with a softly filled rounded selection and a visible neutral hover. The selected fill replaces the media underline; Activity / Recents keep their lighter underline treatment. The bar still measures 45 px with 44 px click targets and no additional row. The existing browser suite passes at 320 / 390 / 768 / 1440 px, including navigation between all three media routes and production-off behavior. Live preview and diff checks pass. Private capture: `creation-mode-highlight.png`.

## Follow-up — align the first gallery card with the preview

Removing the desktop title had left 24 px of extra inset above the gallery. Rails whose header lives in navigation now remove the old aside top padding and list margin, and use the same 8 px media inset as the preview. The custom scrollbar follows that inset. Mobile spacing and rails with their original header are unaffected.

Live measurements at 768 / 900 / 1171 / 1440 px put both the preview and first card at y=137 px, compared with 137 / 161 before the fix. The scrollbar also starts at 137 px; 390 px retains the mobile layout without horizontal overflow. Thirteen gallery and architecture checks, focused ESLint and diff checks pass. The sample-selection contract now reads the previously extracted props from `gallery-rail-types.ts`. Private capture: `gallery-preview-top-alignment.png`.

## Follow-up — Milo assistance levels

The existing 44 px identity row now offers `Milo Standard ▾` beside the short generation-model name. The lightweight menu contains Lite (simple prompts), Standard (everyday creation) and Max (complex ideas). It reuses the shared keyboard-accessible SelectMenu with a viewport-constrained portal, and does not add a row or move the writing area. Selection survives switching between Prompt and AI assistant; drafts and conversation are retained.

This is a development-preview preference only. It does not change simulated replies, call a provider, debit credits or alter the media generation price. The implementation remains behind the existing development-only assistance flag.

Provider hypotheses from Adrien, to benchmark before wiring or pricing: Lite → Luna with high reasoning; Standard → Terra with high reasoning; Max → Sol with very high reasoning or Astra at standard reasoning. These are not validated API identifiers or supported effort settings. Compare prompt quality for the selected media model, latency, input/output/reasoning usage and cost across the same briefs before deciding exact routing and credit consumption. Preserve the existing Milo credit system when connecting real assistance.

Eight focused composer, layout and panel checks pass, including Chromium/WebKit at 320 / 390 / 1440 px, keyboard selection and Escape, preserved manual/unsent drafts, and stable empty-frame geometry. TypeScript, focused ESLint and diff checks pass. The authenticated 390 px menu measures 186 px high, has no horizontal overflow, and retains only 4 px padding around its options. Private captures: `milo-level-selector.png` and `milo-level-mobile.png`. No generation or LLM call was made.

## Follow-up — Seedance warning inside the video picker

In the compact preview, the recognizable-person notice now appears immediately above the video upload controls, both in the direct source picker and the Video section of References. It is removed from the writing footer in both Prompt and AI assistant, and does not appear when selecting image or audio references. The notice wording, eligibility and non-preview presentation are unchanged.

Fifteen focused checks pass, including Modify/Extend with both writing tabs at 320 / 390 / 1440 px and existing production Extend behavior. TypeScript, focused ESLint and diff checks pass. Authenticated Seedance 2.5 verification confirms the notice inside the source picker; private capture: `seedance-warning-in-references.png`.

## Follow-up — group references and keep source clips out of Create

The picker puts Images / Videos / Audio on its first row, followed by Start image / End image and the workflow source when applicable. Images is the initial selection when available. The compact Create picker excludes video fields reserved for Modify, Extend or Reframe; actual video references remain available. Modify retains its source clip, and Extend retains its dedicated source entry. This changes presentation only, preserving field identifiers, attachment callbacks and workflow inference.

Two focused integration checks pass, covering row order, initial selection, Create filtering and retained Modify/Extend source access in both writing tabs at 320 / 390 / 1440 px. TypeScript, focused ESLint and diff checks pass. The authenticated Seedance 2.5 Create picker shows the two rows without Source video; private capture: `reference-picker-two-rows.png`. No generation or LLM call was made.
