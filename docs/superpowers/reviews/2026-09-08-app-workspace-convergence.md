# App workspace convergence — 8 September 2026

## Scope

This increment starts at `cd7d3e819` on the isolated `codex/app-catalogue-validation` branch. It brings the connected app closer to the approved visual direction across Creation, Media, Activity, Tools, reference pickers and contextual actions. Studio/timeline integration remains a separate lot. Nothing is merged, pushed or deployed by this increment.

## Product changes

- Creation: family navigation, searchable complete model catalogue with explicit legacy access and progressive details; compact mobile Recents in the heading; app and prompt scrollbars.
- Media and gallery rail: visual collections and smaller result cards, shared contextual preview/reuse panel, explicit image/video destination confirmation, exact-original handoff bound to account and one-use navigation token.
- Activity: one paginated feed with all eight real sources, chronological cards, scoped loaded-status filters, loading/retry states, shared media actions and continued pagination. Multi-image identity follows the production zero-based output suffix.
- Tools: five existing routes presented as a visual catalogue with actual character/angle/cutout covers and lightweight storyboard/upscale illustrations.
- References: compact role navigation with used/capacity counts; single Start/End import or library choice; a focused thumbnail chooser with provisional selection and explicit confirmation. Normal selections remain single-insertion, characters retain immediate toggles, and audio source selection retains its exact payload. Source, Mask and custom schema roles keep distinct names, and source-picker listings reject stale account responses. Destructive library management remains in Media.

## Visual and functional evidence

Root browser checks used real connected screens at 390×844, 1280×720 and 1451×1073, in light and dark themes. Verified model search/details, responsive Recents, portal bounds and focus return, media continuation panels, Activity sources/status/pagination, five tool destinations, reference roles including Audio, staged reference cancellation and source video picker posters. No paid generation, upload, media deletion or draft insertion was invoked during these UI checks. Temporary audio/video modes and light theme were restored.

Reference-picker first thumbnails now start at 196px on mobile versus 449px before. Its enabled confirmation fits at bottom 825 px in an 844 px viewport. The audio source picker displays 60 lazy posters and no video elements. Screenshots and detailed logs are in `.superpowers/artifacts/2026-09-07-app-workspace-convergence/`.

## Performance boundary

Activity now requests one initial 24-item feed instead of seven eager source feeds. This is a request-count reduction, not evidence of faster initial loading: two stable guarded development measurements still took 18.455 s and 17.267 s for the first feed. The next 24 items loaded in 0.939 s. Initial latency remains unresolved; no production Core Web Vitals improvement is claimed. Do not attribute the delay to a specific database/auth/enrichment phase without measurements.

## Environment boundary

Connected checks use the explicitly guarded disposable Neon data branch; provider, payment and storage-write credentials are omitted. That temporary copy expires 10 September 2026 at 16:43:50 UTC; the production primary has no expiry. Build/tests use sanitized launchers. Available Node 23.9 differs from the repository Node 22 target. Paid generation, real uploads, production writes and Safari behavior are outside this qualification.

## Final validation

The first complete run exposed five failures: one real ambiguity between same-kind schema roles and four stale test adapters/assertions. A single final correction wave at `45c45a812` preserves distinct Source/Mask/custom names, maintains the behavioral assertions and fixes the known pre-existing audio account-cache gap. All 37 focused checks, including the five earlier failures, pass. The fresh production build passes with 861 generated pages; `pnpm run test:validate` passes all 4,469 tests with zero failures or skips (90.3 seconds). TypeScript, frontend lint, exposure and whitespace checks pass. The independent scoped rereview approves all three corrections with no residual actionable finding. Final source is `45c45a812`; subsequent changes are qualification documentation only. The guarded local preview was restarted after the complete-manifest checks.

Task reports, the complete failure/correction trail and independent review reports are preserved locally in `.superpowers/artifacts/2026-09-07-app-workspace-convergence/review-record/`. The active SDD workspace is removed after archival; the isolated branch and checkout remain for user validation.
