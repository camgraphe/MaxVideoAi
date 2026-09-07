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
