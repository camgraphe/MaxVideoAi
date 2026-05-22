---
id: image-to-video
label: Image to video
knowledge_version: 0.1.0
---

# Image To Video

Source of truth: `frontend/lib/ai-strategist/workflow-rules.ts`

## Definition

The user has a source image or reference asset and wants controlled motion around that asset.

## Best For

Product references, character references, brand visuals, and controlled commercial motion.

## Avoid For

No-reference requests that depend entirely on generated visual identity.

## Recommended Prompt Structures

product-ad, brand-asset, character-scene, social-ad

## Planning Steps

- Extract what must remain stable from the image.
- Choose a model with the right detail and motion tradeoff.
- Prompt the camera move and protected visual details separately.
- For real person or character reference images, prefer Kling or LTX. Avoid Seedance and Sora unless the image was generated in a compatible Seedream/text-to-image workflow first.

## Tier Guidance

- Best: final brand or product assets where fidelity matters.
- Medium: campaign drafts with reference fidelity and active iteration.
- Value: movement, framing, or social variants from a reference.
