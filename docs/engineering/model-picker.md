# Contextual model picker

Reviewed: 2026-10-25. Preview integration; production release remains a separate gate.

`EngineSelect` keeps its controlled API. A workspace `picker` context enables its lazy dialog; consumers without that context and the comparison's explicit multi-selection browser retain their existing behavior. Video and Image supply route-local preparation adapters. The picker only commits after Apply and, when applicable, confirmation of changed settings. Closing, browsing, search and information views do not write a draft or submit generation.

`agent-model-editorial-policy.json.workspaceSelection` owns the reviewed video groups and ordering. `model-picker-policy.ts` intersects them with the supplied current, published, supported catalogue. Model identity and capabilities remain in the registry and generated engine catalogue. Image and operations without reviewed picks open the family catalogue. No default, memory, URL, project or guest-demo hydration priority changes in this preview.

Video uses `prepareWorkspaceModelCandidate` and `buildWorkspacePreflightRequest`, then the existing transactional model-review owner to apply the prepared draft. Picker switching blocks reference removal and operation changes. Image uses the existing schema helpers and `/api/images/estimate`, retaining reference counts, measured sizes and priced settings. Missing source media leaves an explicit prerequisite instead of a price for another operation. An incompatible image mask blocks selection.

`model-picker-estimates.ts` owns a success-only cache (60 seconds, 48 entries), in-flight sharing, three simultaneous requests and leases that cancel queued work when no view needs it. Contexts include the account/auth scope and exact canonical quote inputs. The comparison shares the video queue; errors are not cached. Tariff refresh invalidates caches and rendered results. Each estimate transport has a 15-second timeout. Active work can finish after closing for immediate reopening; queued work is removed. The authoritative generation preflight remains fresh and separate.

The dialog only estimates intersecting rows. Closed family rows are unmounted. Candidate preparation and full video draft serialization run only while the picker is open. The dialog is dynamically imported on demand. The portal carries the app theme scope and uses a scrollable body with fixed search and action areas. Information/close controls are 44 pixels; phone text is not reduced below the approved readable sizes.

For preview/local QA, `?pickerDebug=1` emits bounded client timings and queue counters tagged `[model-picker]`. It logs only public model IDs, timing and counters, never credentials, prompt text, media URLs or cache keys. Diagnostics are disabled in production and send no telemetry. Timings measure this browser session, not field p95 or Core Web Vitals.

Focused verification: `model-picker-*.test.ts`, `workspace-model-picker.test.ts`, `image-model-picker.test.ts`, existing model-review/comparison tests, selector architecture and image/workspace contracts. Before release, also verify an authenticated preview on desktop and narrow mobile, actual prices, confirmation/cancel, family search, closed/warm reopen behavior and unchanged prompt/references. No test generation is necessary to verify estimates.

## Integrated price comparison (2026-10-25 follow-up)

The popup has viewport-bounded fixed geometry; only the family/model body scrolls as rows expand. The price-basis section is visually accented. Video supplies compact native-select descriptors through `PickerPriceContext`; Image retains its exact settings summary. The workspace Compare entry is retired in favor of this selector, while `savedOnly` preserves the previous-configuration recovery flow. Public comparison routes remain independent.

`workspace-picker-scenario.ts` owns provisional common settings and preparation shared by estimates and Apply. `useWorkspaceModelPicker` resets the scenario on close or external source/account changes. `useWorkspaceModelReview.applyPickerScenario` rejects stale sources/accounts and commits the prepared model and settings atomically, including a same-model settings change. Source-managed duration stays read-only, requested Auto duration is selectable, and `keep_audio` is distinct from generated audio. Per-row summaries disclose effective model adaptations. The existing visible-only, bounded, debounced quote queue is unchanged.
