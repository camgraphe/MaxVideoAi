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
