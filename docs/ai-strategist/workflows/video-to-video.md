---
id: video-to-video
label: Video to video
knowledge_version: 0.1.0
---

# Video To Video

Source of truth: `frontend/lib/ai-strategist/workflow-rules.ts`

## Definition

The user has a video source and wants restyling, refinement, extension, or guided transformation.

## Best For

Restyled clips, motion-preserving experiments, reference-led edits, and animatic refinement.

## Avoid For

Precise legal text changes and large story changes that conflict with the input video.

## Recommended Prompt Structures

cinematic-scene, character-scene, social-ad

## Planning Steps

- Identify what must remain from the source video.
- Separate preservation instructions from style or scene changes.
- Choose a model that supports reference-led continuity.

## Tier Guidance

- Best: continuity and final polish.
- Medium: practical reference-led refinement and campaign options.
- Value: low-cost restyle tests and animatic iteration.
