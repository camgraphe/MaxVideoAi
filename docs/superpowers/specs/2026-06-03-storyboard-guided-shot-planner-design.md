# Storyboard Guided Shot Planner Design

Date: 2026-06-03

## Decision

Build the storyboard tool as a guided assistant with an automatic shot planner.
This is option B from the product direction review: keep the visible UI simple, but make the generated storyboard more reliable by deriving a shot map from the user's brief, references, target engine, style, duration, and dialogue.

## Goals

- Make Storyboarder feel like a standalone paid tool, not a renamed image generator.
- Keep the user-facing form short: subject, action, dialogues, references, target, style, duration, frame count, and quality tier.
- Hide the full GPT Image 2 prompt from the user.
- Generate a useful visual shot map before generation so users understand what the storyboard will try to produce.
- Preserve target-specific policy guidance:
  - Seedance: product, cooking, props, animation, stylized/non-human subjects; no real people.
  - Kling: realistic people and human scenes are allowed when requested.
- Keep Normal and HQ as separate prices, sold at 3x provider cost.
- Preserve the post-generation flow: edit image, save to Storyboard library, and prepare for future send-to-video actions.

## Non-Goals

- No per-panel image generation in this iteration.
- No persistent storyboard drafts yet.
- No visible full prompt or raw prompt editor.
- No complex timeline editor.
- No automatic launch of a paid video generation job.

## User Experience

The page should remain a two-column workspace.

Left column:
- Compact brief fields:
  - Subject
  - Action
  - Dialogues
  - Reference images, up to 4, using the same plus-slot pattern as Generate Video
- Target model selector:
  - Seedance
  - Kling
- Creative controls:
  - Style: Realistic, Anime, UGC, Cinema
  - Duration: 6s, 10s, 15s
  - Frames: 4, 6, 8
  - Price: Normal, HQ
- Primary CTA:
  - Generate storyboard

Right column:
- Before generation, show a live "Shot map" instead of only an empty preview.
- The shot map should display one card per frame with:
  - panel number
  - shot type
  - camera/framing hint
  - motion or action beat
  - optional dialogue beat when dialogue exists
- After generation, show the generated storyboard image with actions:
  - Download
  - Edit image
  - Save to Storyboard library

The shot map is user-visible planning context. It is not drawn as text inside the generated storyboard image.

## Shot Planner Behavior

Add a colocated pure helper:

`frontend/src/components/tools/storyboard/_lib/storyboard-shot-plan.ts`

Suggested types:

```ts
export type StoryboardShotPlanInput = {
  subject: string;
  action: string;
  dialogue?: string;
  style: StoryboardStyle;
  targetModel: StoryboardTargetModel;
  durationSec: number;
  frameCount: number;
  referenceImageCount?: number;
};

export type StoryboardShot = {
  id: string;
  panel: number;
  title: string;
  framing: string;
  actionBeat: string;
  visualPriority: string;
  dialogueBeat?: string;
};
```

The helper should return deterministic plans.

Default frame mapping:

- 4 frames:
  - Establishing / context
  - Hero subject or product action
  - Detail / reaction / texture
  - End frame
- 6 frames:
  - Establishing / context
  - Subject or product setup
  - Main action
  - Detail / texture / reaction
  - Transition or payoff
  - End frame
- 8 frames:
  - Establishing / context
  - Subject or product setup
  - Main action
  - Detail / texture
  - Secondary angle
  - Reaction or transformation
  - Payoff
  - End frame

Style adjustments:

- Realistic:
  - natural continuity
  - practical lens language
  - stable physical detail
- Cinema:
  - stronger lens language
  - controlled lighting
  - clear start/middle/end staging
- UGC:
  - handheld feel
  - creator/social framing
  - natural reaction beats
- Anime:
  - expressive poses
  - clean production-board clarity
  - stylized motion beats

Dialogue behavior:

- Parse dialogue lines loosely.
- Preserve speaker labels when users write `Speaker: line`.
- Assign dialogue beats across the middle panels, not the first and last by default.
- Prompt guidance must state that dialogue should inform performance, timing, mouth/body motion, and reactions, but no subtitles, captions, speech bubbles, or dialogue text should be drawn.

Reference behavior:

- If reference images are present, add visual priority hints to preserve:
  - character identity
  - product shape
  - packaging
  - material/color
  - location or style cues

## Prompt Builder Changes

Keep `buildStoryboardPrompt` as the single internal prompt builder.

Extend its input to accept `shotPlan`.

Prompt structure should include:

- Video length and frame count
- Subject
- Action
- Dialogue/audio direction
- Reference image guidance
- Target guidance for Seedance or Kling
- Style guidance
- Shot map lines:
  - `Panel 1: ...`
  - `Panel 2: ...`
- Negative instruction:
  - no UI chrome
  - no captions
  - no speech bubbles
  - no prompt text
  - no watermark

The prompt remains hidden from the user.

## Component Architecture

`StoryboardWorkspace.tsx` is already over 600 lines, so the implementation should reduce it while adding behavior.

Add route-local/shared-by-tool components under:

`frontend/src/components/tools/storyboard/_components/`

Recommended components:

- `StoryboardBriefPanel.tsx`
  - subject/action/dialogue fields
  - references dropzone
  - target/style/duration/frame/price controls
  - generate CTA
- `StoryboardShotMap.tsx`
  - renders the live shot plan cards
- `StoryboardResultPanel.tsx`
  - renders empty, loading, and generated image states
  - download/edit/save actions
- `StoryboardAuthModal.tsx`
  - optional extraction if the parent remains too large

Keep server-only logic out of these client components. The current upload and generation calls can stay in the client workflow because existing app patterns already use `authFetch`, `runImageGeneration`, and `saveImageToLibrary`.

## Data Flow

1. User edits visible fields.
2. Workspace state feeds `buildStoryboardShotPlan(...)` through `useMemo`.
3. The shot map is displayed immediately in the right panel before generation.
4. On generate:
   - ready reference images become `imageUrls`
   - mode is `i2i` when references exist, otherwise `t2i`
   - prompt is built from brief + shot plan
   - result source remains `storyboard`
5. On edit image:
   - selected generated image is sent as the source image
   - edit instruction is appended to prompt
6. On save:
   - image is saved to the Storyboard library source.

## Pricing

Keep the existing two-tier pricing:

- Normal
- HQ

The UI should keep showing final customer price. The backend pricing rule remains 3x provider cost for storyboard source.

Future enhancement: if image-to-image reference count changes cost, the estimate should be recomputed from the active mode and reference count. That is out of scope unless the current estimate is already incorrect.

## Error Handling

- If subject is empty, keep the existing subject-required error.
- If a reference upload fails, show the existing upload error and preserve the failed slot state.
- If generation fails, show the generation error in the brief panel.
- If price estimate fails, keep `...` pricing instead of blocking the form.
- If target is Seedance and the subject/dialogue suggests real people, show a lightweight warning but do not block. Blocking can be added later if product policy requires it.

## Testing

Add focused tests before implementation:

- `tests/storyboard-tool-contract.test.ts`
  - storyboard uses `buildStoryboardShotPlan`
  - workspace renders `StoryboardShotMap`
  - prompt builder receives `shotPlan`
  - prompt remains hidden
- New or extended unit-style test for shot planner:
  - 4, 6, and 8 frame mappings
  - dialogue allocation across panels
  - Seedance/Kling target guidance preserved
  - reference-image guidance preserved

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Do a Browser QA pass on:

`http://localhost:3000/app/tools/storyboard?target=kling`

Checks:

- page loads with no framework overlay
- shot map appears before generation
- changing frame count changes the number of visible shot cards
- dialogue text appears as visible planning context in shot cards
- reference plus slots still render
- generate button becomes enabled after subject is filled
- no paid generation is triggered during QA

## Acceptance Criteria

- The user can fill a compact brief and see a live shot map.
- The shot map changes when duration/frame count/style/dialogue changes.
- The generated prompt includes shot plan guidance internally.
- The full prompt is not visible.
- Reference images still support up to 4 plus-slot uploads.
- The tool still supports Normal and HQ pricing.
- Generated storyboards can still be edited and saved to Storyboard library.
- `StoryboardWorkspace.tsx` is reduced or at least not made larger by the feature extraction.

## Open Implementation Choice

For v1 implementation, use deterministic shot planning rather than another AI call. This keeps the tool fast, cheap, and predictable. If later we want AI-authored shot plans, add it as a paid optional enhancement after the deterministic planner is working.
