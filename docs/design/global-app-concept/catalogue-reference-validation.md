# Connected app catalogue and reference validation

The user approved validating the real app and specifically requires the complete AI engine selection by family and faithful model-specific reference availability. The approved cream/charcoal/saffron visual direction and compact named commands remain the presentation contract.

## Evidence at the start

- The prototype exporter deliberately lists six video models. It is a visual sample, not the application catalogue.
- The authored registry publishes 40 video engines (32 current, 8 legacy) and 9 image engines (8 current, 1 legacy) for the app. These are observed counts, never authored UI constants.
- The real video dropdown shows the 32 current engines across 12 families and has an existing legacy toggle. Its coverage and filter state need clearer presentation and catalogue-wide regression coverage.
- `WorkspaceReferenceSection` forwards computed field restrictions into popup dropzones but its compact command buttons do not express those restrictions visually or semantically. A disabled reason is only a title on frame commands.
- `getWorkspaceReferenceFields` computes Seedance/Kling restrictions but overwrites incoming disabled state. Preserve restrictions already supplied by an owning model surface.

## Requirements

1. Every app-published, available engine must remain reachable through its proper category and canonical family, including legacy engines through an explicit filter. Selected legacy engines remain visible. Preserve private canary, publication and provider-availability boundaries.
2. Clearly show catalogue/filter coverage, localized counts, complete family labels and a useful empty-search state. Do not duplicate variant/model entries or invent engine availability.
3. Compact reference commands visibly reflect model restrictions before opening a popup. Reasons must be available on touch and keyboard, not only hover. Empty blocked commands cannot launch import/library. Existing media must remain manageable so users can remove an incompatible selection.
4. Partial restrictions in a mixed reference collection must preserve the allowed media kinds. Seedance's start/end-versus-references rule must not become a universal rule: preserve Kling, Veo, Happy Horse, Omni, Luma and audio-specific owners and budget constraints.
5. Add/remove/replace, sparse indices, file drops, Library and Recents must use the same existing validation and insertion contracts. A valid removal unlocks the compatible commands again. Preserve field identities, inputs, pricing and actual submission mode.
6. Validate the real application and connect available backend read paths after inspecting their side effects. Do not equate local fixtures with a live generation. Paid generation, production writes, deployment and merge are outside this validation lot unless separately authorized with a concrete operation.
7. Work on the isolated branch `codex/app-catalogue-validation`, based on the previously validated `8d431d688`. Keep the earlier branch available for comparison. No dependency additions or registry policy changes are needed for presentation fixes.
8. Retain 44px essential targets, unclipped prompt focus, desktop/mobile reachability, light/dark contrast, keyboard focus, Escape/restoration and reduced motion. Keep temporary QA routes out of commits and final builds.
9. Treat useful capabilities discovered in the existing application as product requirements when adapting the approved concept. Preserve model variants, workflow toggles, advanced options, media actions and field-specific controls. Simplify presentation and measured resource waste without silently dropping these capabilities; derived catalogue information must not add requests.


## Qualification environment and preservation

A dedicated Neon preview branch contains a temporary copy of the existing application data. The local launcher verifies its identity, endpoint and expiration before connecting; no production `.env` was changed. Provider, payment and storage write credentials are omitted. The branch expires on 10 September 2026 at 16:43 UTC.

The connected preview has verified wallet display, historical video/image results, membership-aware quotes, the published video/image catalogue, and completion-event averages with positive sample counts. Library-to-start-image selection and removal use the existing stored asset without upload. These checks do not establish a successful provider generation or a payment flow.

Some legacy recent outputs need a storage HEAD request to recover missing file metadata. This preview cannot qualify that path without storage access; the interface keeps Add disabled with the existing explanation. Do not bypass metadata validation to make the preview appear functional. Existing isolated metadata tests cover ownership, bounded storage access and validation separately.

Keep the library's stored/generated and media-kind filters, source-specific collections, creation-tool links, original downloads, advanced composer options, variant selection, and reference management. Catalogue summaries derive from the existing data, dialogs mount on demand, and recent-output metadata is requested only for the chosen item. No dependencies or new background request loop were added. Development request timings and viewport checks are not production Core Web Vitals evidence.

At source commit `bfa797b48`, the full repository suite passed 4,445 tests with no failures or skips. The production build generated all 861 pages and passed registry, media-coherence, lint and type checks. Validation ran on the locally available Node 23.9; the repository targets Node 22, so CI on that target remains a separate runtime gate. Browser checks covered native 1440, 900, 390 and 320 px widths plus short landscape; this does not qualify mobile Safari on physical devices.

Independent task review identified a focus transition after removing the last asset from an upstream-locked field. The fix at `77a4f7f68` uses guarded `aria-disabled` commands so they remain focus targets while activation stays blocked. Frame and collection removal → Escape regressions and 43 focused checks pass; scoped re-review found no remaining issue or new breakage.
