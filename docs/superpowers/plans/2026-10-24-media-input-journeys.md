# Media input journeys implementation plan

> **For agentic workers:** use the approved parallel-agent allocation below; verify each scoped change before integration. Steps use checkbox syntax.

**Goal:** Make importing and reusing media understandable and compatible with the exact selected model, mode, operation and reference slot.

**Architecture:** Retain authored provider schemas and the shared excerpt, upload, ownership and pricing owners. Add one browser-safe eligibility projection for pickers; keep server validation authoritative. Improve existing composer reference controls rather than adding another editor.

**Tech stack:** Next.js, React, TypeScript, existing Node/DOM/browser contract tests.

**Spec:** Adrien's request of 24 October: fix H3 missing price/invalid operation and unusable selection, audit all models, filter library/import compatibility, show recognizable removable thumbnails and insert supported reference labels at the prompt cursor. Show locally before pushing. Paid H3 Extend qualification deferred.

## Global constraints

- No push, production change, generation charge or client-media migration during this review.
- Preserve original bytes and canonical identities, private read grants, account fencing, public links and reusable parameters.
- Preserve all existing model modes and Draft; do not infer capabilities from sibling versions.
- Do not invent a price, minimum duration, reference token or compatible conversion.
- Prefer an existing shared owner over a new model-specific branch.

## Review focus

- Too-short media cannot be repaired by trimming: explain the minimum and offer replacement.
- Long media that fits preparation limits remains selectable; quote only the prepared measured selection.
- Old/generated assets can have incomplete metadata; unknown is not incompatible, and server facts remain authoritative.
- Switching account/model/operation/slot during asynchronous import or preparation cannot attach a late result.
- Removing a referenced asset cannot silently retarget a prompt token to a different asset.

## Task 1 — Exact-slot eligibility and library/import selection

**Owner:** media_compatibility agent.
**Files:** new `frontend/lib/media-input-eligibility.ts`; existing recent-media availability, library picker/modal wiring and reference upload owner; focused tests.

- [x] Reproduce missing full-library compatibility and overstrict recent-media filtering with actual schemas.
- [x] Project compatible / selectable with preparation / requires verification / incompatible from known facts and exact selected slot.
- [x] Keep long-but-trimmable assets and unknown metadata visible; show actionable reasons for incompatible items.
- [x] Reuse policy at import and selection boundaries without weakening server checks.
- [x] Test current model/operation inputs, minima/maxima, incomplete facts and unsupported kinds.

## Task 2 — Passage selection and price recovery

**Owner:** source_price_excerpt agent.
**Files:** shared excerpt policy/copy/selector/control and existing workflow hook; focused tests. Investigate trusted-dimension failure in current preflight separately before expanding server scope.

- [x] Pin observed H3 Recast 4-second source versus its 5-second minimum.
- [x] Replace the impossible trim path and generic price notice with a precise reason; retain legal full-original and measured fractional behavior.
- [x] Replace user-facing “Excerpt” with clear section/passage wording in English, French and Spanish.
- [x] Verify operation-specific limits and authoritative measured source facts through preflight and preparation.
- [x] Exercise imported/generated/private source, cancel/reset, audio reference, model switch and quote invalidation.

## Task 3 — Selected thumbnails and safe prompt mentions

**Owner:** reference_thumbnails agent.
**Files:** shared composer reference section, thumbnail/mention helpers, Composer prompt wiring, attachment thumbnail projection, CSS and focused tests.

- [x] Project existing stored thumbnail separately from the original source URL.
- [x] Show compact recognizable references, role/number labels and independent remove controls; never eagerly load all video originals.
- [x] Insert only authored/provider-supported mention syntax at the retained prompt cursor.
- [x] Preserve association after removal/reordering; warn and prevent silent wrong-reference submission.
- [x] Verify mouse/keyboard, missing posters, private signed thumbnails and narrow screens.

## Task 4 — Integration, local review and capability inventory

**Owner:** parent.

- [x] Document distinct findings: stale PR508 frontend; H3 4-second source too short; reused source lacks trusted dimensions on current API.
- [x] Integrate agents' changes and run relevant contract/DOM suites, typecheck, lint and exposure checks.
- [x] Build a local review using actual shared components, clearly distinguishing fixture data from live API proof; inspect desktop and mobile.
- [x] List intentionally pending modes with reasons and save an exact deferred H3 Extend trial payload, without dispatch.
- [x] Show the result and verified limits to Adrien before any push.

## Integration review

Three independent agents completed implementation and crossed their reviews. Review-driven fixes preserve image compression before size enforcement, strict geometry checks, Kling prompt aliases and inactive single/multi-prompt bindings. The specialized Kling element picker is included in the final bounded audit. No generation dispatch, push or production state change is part of this local review.

Final evidence: integrated251 tests, browser/helper11, then final Kling/import/picker85 (overlapping suites), full TypeScript, ESLint0errors/6existing warnings, exposure and whitespace checks. Independent finalreview57 focused tests found no remaining actionable defect. Local review only; hosted authenticated qualification and CI belong to a subsequent authorized push/release.
