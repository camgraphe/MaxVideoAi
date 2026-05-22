---
id: social-ad
label: Social ad
knowledge_version: 0.1.0
---

# Social Ad Prompt Structure

Source of truth: `frontend/lib/ai-strategist/prompt-structures.ts`

## Goal

Create a short-form ad that communicates a hook quickly and works in a feed.

## Required Inputs

platform or aspect ratio, hook, subject, offer or message, visual payoff

## Structure

- Hook: visual moment that stops scrolling.
- Format: vertical, square, or landscape framing and intended pacing.
- Visual payoff: transformation, reveal, or benefit shot.
- Loop or ending: loop, CTA landing, or story resolution.

## Model Adaptation

Use Kling 3 Standard for value product social, Seedance 2.0 Fast, Veo 3.1 Lite or LTX 2.3 for A/B tests, consider Happy Horse as a strong candidate for compatible audio/lip-sync/spokesperson social clips, and Veo 3.1 Fast for realistic polish.

## Negative Checklist

slow opening, confusing hook, crowded frame, tiny unreadable text
