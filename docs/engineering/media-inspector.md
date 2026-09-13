# Shared media inspector and comparison journey

## Owners

- `frontend/components/library/MediaDialog.client.tsx`: accessible modal boundary, portal, focus return, Escape, backdrop.
- `MediaActionPanel.client.tsx`: selected original, poster-to-manual-video player, image/audio reader, download and native/link sharing, progressive details. An asset change resets playback and share state. Video is mounted only on Play, audio uses preload none.
- `GalleryMediaActionPanel.client.tsx`: grouped output selector and member details. Historic hero-only save/reuse callbacks are offered only for the main output. Other actions use the selected output.
- `frontend/components/MediaLightbox.tsx`: adapts ready results to the inspector and preserves pending/failed job controls. It mounts only the selected output.
- `MediaDestinationActions.client.tsx`: compatible next actions. Gallery originals are resolved against the account-scoped recent output listing on action, never inferred from a thumbnail. A change of account/media invalidates async navigation.
- `frontend/lib/media-handoff.ts`: bounded, account-scoped, expiring, single-consumption transport of exact original identity. The receivers own source validation and generation. No paid operation runs on navigation.
- `ToolMediaHandoff.client.tsx`: confirms source selection in Upscale, Angle, BackgroundRemoval and Finishing workspaces, then delegates to the existing source controller. Recent job output IDs are not saved media asset IDs.

Image offers animation, image generation, upscale and angle. Video offers reference, extension, upscale and compatible finishing tools. Audio offers video reference. Extension retains a compatible source model where known, otherwise selects a published current general clip extender. Veo is considered only for known Veo sources. Incoming engine hydration must finish before consuming the video handoff; do not wait on submissionMode, which unified composers derive from the very input being inserted.

Reference roles remain owned by `WorkspaceRecentReferences` / `WorkspaceRecentRoleDialog` and existing field/budget validation. Opening or cancelling the inspector never inserts/replaces a reference.

## Compare

`useWorkspaceModelAlternatives` owns six selected alternatives and bounded exact-request quote caching (48 entries, 60 seconds, account scoped). Default suggestions are quotable; explicitly added incomplete candidates remain as unpriced cards. No failed/missing-input candidate receives an invented price. Cache scopes include all quote inputs and batch size; final model application uses the existing fresh candidate preflight and confirmation.

The comparison action trigger reuses `EngineSelect` and its family browser through its optional `trigger` / `selectedIds` API. Filter models by video category before both catalogue rendering and candidate building. Adding changes only the comparison list; it must never invoke `requestModel`, apply a draft or open the model-change review. That is the card’s Select action. Saved setup recovery remains separate under Previous settings.

## Sharing scope

Share currently invokes native sharing or copies the original media URL. Original links may expire. This is not a stable public page, a revocable share token, or a visibility change. Prompt, cost and other details are not included in the share payload. No automatic sending occurs.

## Verification

Relevant contracts: `media-action-panel-dom`, `media-tool-handoff`, `media-library-contract`, `workspace-recent-media-dom`, `workspace-model-review-dom`, `engine-select-architecture` and `group-viewer-pending-job-controls` tests. Keep account isolation, focus/keyboard, selected-output identity, missing-input states and no draft mutation during comparison covered.

Local browser checks exercised library image/video inspector, first Play, gallery inspector, Upscale handoff and quote without generation, extension insertion with an enabled quoted Generate action (not submitted), and comparison additions/removal. MiniMax H3 was added through its family and quoted while Seedance remained active. These functional checks do not establish a Core Web Vitals improvement.

Validation on 2026-09-09: 68 focused tests passed, followed by 29 comparison/selector tests after the final UI corrections; TypeScript, ESLint and public exposure checks passed. The broader Node 22 / PostgreSQL 17 run passed 5,333 of 5,338 tests; five connected-Studio integration tests refused this development worktree because environment files exist. Those isolation guards were not bypassed. No paid generation, payment, deployment or database migration was performed.
