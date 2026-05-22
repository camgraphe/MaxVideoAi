---
id: cinematic-scene
label: Cinematic scene
knowledge_version: 0.1.0
---

# Cinematic Scene Prompt Structure

Source of truth: `frontend/lib/ai-strategist/prompt-structures.ts`

## Goal

Create a realistic scene with coherent subject action, lighting, camera behavior, and emotional tone.

## Required Inputs

subject, action, location, mood, camera behavior

## Structure

- Scene premise: who or what is in the scene and what is happening.
- Camera and light: camera movement, lens feel, light source, and time of day.
- Motion beat: visible action progression in one concise sequence.
- Realism guardrails: what should remain natural, grounded, and physically plausible.

## Model Adaptation

Use Veo 3.1 for premium realism, Sora for imaginative narrative scenes, and Seedance 2.0, Happy Horse or Veo 3.1 Lite when motion, audio, or practical campaign speed matter.

## Negative Checklist

uncanny faces, unmotivated camera moves, physics errors, style conflicts
