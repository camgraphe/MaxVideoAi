---
id: happy-horse-1-0
label: Happy Horse 1.0
knowledge_version: 0.1.0
---

# Happy Horse 1.0

Source of truth: `frontend/lib/ai-strategist/model-catalog.ts`

## Strategic Position

- Tier: Medium
- Workflows: text-to-video, image-to-video, text-to-image-then-image-to-video, video-to-video
- Relative cost: high
- Relative speed: medium
- Quality level: high
- Scores: realism 4, motion 4, product detail 3, social ad 4

## Best For

Native-audio clips, lip-sync and dialogue support, talking-avatar experiments, and unified text/image/reference/video-edit workflows.

## Avoid For

Strict product packshots, 4K delivery, lowest-cost bulk drafts, raw realism comparisons against Veo or Kling, and real-person image-to-video preservation as the primary route.

## Strengths And Weaknesses

Strengths: native synchronized audio, lip-sync, and text-to-video, image-to-video, reference-to-video and video edit in one model family.

Weaknesses: no 4K output route, higher cost than budget value models, less product-detail authority than Kling, and limited real-person image-to-video preservation.

## Prompt Guidance

- Strong candidate for compatible audio/lip-sync/spokesperson workflows, but do not promote it as the automatic Best model only because dialogue is present.
- Keep dialogue short and tied to one clear on-camera performance beat.
- For reference workflows, assign each uploaded image or source clip one clear job.

## Negative Prompt Guidance

- Avoid long monologues or fast speech for lip-sync.
- Avoid exact logos, legal copy, packaging text, or 4K delivery expectations.
