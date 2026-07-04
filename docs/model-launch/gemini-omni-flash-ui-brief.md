# Gemini Omni Flash UI Brief

## Product Goal

Expose Gemini Omni Flash as a Google multimodal video workbench inside the existing MaxVideoAI composer, without turning the workspace into a provider-specific page.

The UI must help users choose between:

- Prompt-only generation
- Source image animation
- Reference-guided video
- Source-video edit
- Conversational refine from a previous Omni interaction

## Selected Direction

Use a compact `OmniStudioPanel` mounted inside `WorkspaceComposerSurface` for `selectedEngine.id === 'gemini-omni-flash'`.

Why this direction:

- It keeps the workspace shell unchanged.
- It keeps Omni source media, previous interaction id, and directive fields close to the prompt.
- It avoids duplicating the generic composer field rendering.
- It can be hidden cleanly when another engine is selected.

## UI Requirements

- Route the workflow from user inputs instead of showing provider-specific mode buttons.
- Keep source slots for one image, up to 10 references, one short source video, and previous interaction id visible in the Omni panel.
- Disable incompatible source slots after the user adds an image, references, a source video, or a previous interaction id.
- Store interaction toggle so refine workflows are intentional.
- Dedicated text areas for sound direction, camera direction, and edit instruction.
- Validation states for missing image, reference images, source video, or previous interaction id.
- No seed, negative prompt, first/last-frame, extend, or 4K controls.

## Visual Rules

- Match the existing composer panel shell:
  `rounded-[24px] border border-border/60 bg-surface-2/70 p-4`.
- Use existing `AssetDropzone` behavior instead of a new uploader.
- Use lucide icons in action buttons.
- Keep cards shallow; do not nest decorative cards.
- Keep labels short and operational. No explanatory marketing copy inside the tool.

## Implementation Ownership

- UI component: `frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx`
- Mount point: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- Schema source: `frontend/src/config/fal-engines/gemini-omni-flash.ts`
- Contract test: `tests/workspace-omni-ui-contract.test.ts`

`AppClient.tsx` should not import Omni UI components.

## Acceptance Checks

- Switching to Gemini Omni Flash shows the Omni panel.
- Switching away hides the panel.
- Generic asset dropzones are not duplicated when the Omni panel owns the active source slot.
- Adding an image, references, a video, or previous interaction id changes the submitted Omni mode automatically.
- Incompatible source slots are disabled rather than exposed as separate mode buttons.
- Omni custom fields survive schema normalization and submission.
- Retake/refine cannot submit without a previous interaction id.
- Source-video edit cannot submit without a source video.
- Reference mode cannot submit without at least one reference image.
