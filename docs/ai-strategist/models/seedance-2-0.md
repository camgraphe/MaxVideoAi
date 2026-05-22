---
id: seedance-2-0
label: Seedance 2.0
knowledge_version: 0.1.0
---

# Seedance 2.0

Source of truth: `frontend/lib/ai-strategist/model-catalog.ts`

## Strategic Position

- Tier: Medium
- Workflows: text-to-video, image-to-video, text-to-image-then-image-to-video, video-to-video
- Relative cost: medium
- Relative speed: fast
- Quality level: high
- Scores: realism 4, motion 5, product detail 4, social ad 4

## Best For

Balanced production drafts, character motion, reference-guided scenes, and social ad variants.

## Avoid For

Strict packshot precision, premium 4K detail, and strict typography recreation.

## Strengths And Weaknesses

Strengths: strong motion, balanced realism, good creative range, and useful reference handling.

Weaknesses: less product-detail authority than Kling 4K and not the cheapest option for bulk drafts.

## Prompt Guidance

- Use continuity anchors such as wardrobe, prop, expression, and location.
- Describe motion beats in sequence when the scene has character action.
- Include reference-image priorities before style language.

## Negative Prompt Guidance

- Avoid excessive lens and grading jargon that competes with the main action.
- Avoid using Seedance for exact product-label reproduction.
