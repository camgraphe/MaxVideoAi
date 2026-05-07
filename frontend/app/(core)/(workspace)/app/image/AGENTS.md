# Image Workspace Route Guide

This route owns the dedicated still-image generation workspace.

## Responsibilities

- `ImageWorkspace.tsx`: route orchestrator; it wires image workspace state, handlers, preview, composer, rails, and modal entry points.
- `_components`: image-specific presentational surfaces and modals.
- `_hooks`: image-specific browser state hooks that do not belong to the shared video workspace route.
- `_lib`: pure image workspace helpers, copy fallbacks, persistence parsing, reference-slot utilities, history mapping, and local group builders.

## Refactor Rules

- Keep copy fallbacks and template formatting in `_lib/image-workspace-copy.ts`.
- Keep reusable image workspace types and storage constants in `_lib/image-workspace-types.ts`.
- Keep character reference parsing, labels, and slot merging in `_lib/image-workspace-character-references.ts`.
- Keep job-to-history and local active group builders in `_lib/image-workspace-history.ts`.
- Keep reference slot state, upload orchestration, library selection, and character toggling in `_hooks/useImageReferenceSlots.ts`.
- Keep preview copy/download actions and generated-library save/remove orchestration in `_hooks/useImagePreviewActions.ts`.
- Keep image setting field derivation, select options, and schema-driven default resets in `_hooks/useImageSettingsFields.ts`.
- Keep browser-only library UI in `_components/ImageLibraryModal.tsx`.
- Keep `ImageWorkspace.tsx` focused on orchestration; do not add new inline helper blocks or route-local modal implementations there.
- Keep image composer storage keys and stored payload shape backward compatible.
- Keep upload, generation, pricing, and auth behavior unchanged unless the task explicitly targets those flows.

## Checks

For image workspace refactors, run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/image-workspace-split-contract.test.ts tests/supabase-browser-session-cleanup.test.ts
pnpm --prefix frontend exec tsc --noEmit
```
