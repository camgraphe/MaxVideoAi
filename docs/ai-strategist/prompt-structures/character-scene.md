---
id: character-scene
label: Character scene
knowledge_version: 0.1.0
---

# Character Scene Prompt Structure

Source of truth: `frontend/lib/ai-strategist/prompt-structures.ts`

## Goal

Create a character-led video with stable identity, clear performance, and believable movement.

## Required Inputs

character identity, wardrobe, action, environment, emotion

## Structure

- Character identity: age range, wardrobe, silhouette, and continuity anchors.
- Performance: expression, body language, and action beats.
- Environment: location and objects that support the action.
- Camera treatment: one camera move that keeps performance readable.

## Model Adaptation

Use Veo 3.1 for realistic human emotion, consider Happy Horse 1.0 as a strong candidate for compatible audio/lip-sync/spokesperson workflows without making it automatic Best, use Sora for story arcs, and Seedance 2.0 for practical motion-heavy concepts.

## Negative Checklist

identity drift, extra limbs, uncanny face, wardrobe changes
