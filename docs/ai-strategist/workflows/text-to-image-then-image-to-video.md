---
id: text-to-image-then-image-to-video
label: Text to image, then image to video
knowledge_version: 0.1.0
---

# Text To Image, Then Image To Video

Source of truth: `frontend/lib/ai-strategist/workflow-rules.ts`

## Definition

The strategist first plans a still image asset, then animates the approved image with a video model.

## Best For

Product ads, brand assets, packshot control, and campaign key visuals.

## Avoid For

Loose cinematic ideas where a still-image approval loop would slow down exploration.

## Recommended Prompt Structures

product-ad, brand-asset, social-ad

## Planning Steps

- Generate or select the still image direction first.
- Protect product, material, and brand details in the animation prompt.
- Choose the video tier based on product detail and campaign importance.

## Tier Guidance

- Best: premium product detail and polished brand assets.
- Medium: product campaigns that need quality without full premium cost.
- Value: motion tests after the still image direction is approved.
