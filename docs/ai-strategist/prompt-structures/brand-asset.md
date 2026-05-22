---
id: brand-asset
label: Brand asset
knowledge_version: 0.1.0
---

# Brand Asset Prompt Structure

Source of truth: `frontend/lib/ai-strategist/prompt-structures.ts`

## Goal

Create a polished brand-safe visual asset with controlled composition, color, and final-frame utility.

## Required Inputs

brand mood, colors, asset type, must-keep elements, final use

## Structure

- Brand system: color palette, visual tone, and must-preserve elements.
- Composition: layout, safe space, focal point, and background simplicity.
- Motion language: subtle motion, reveal, or loop behavior.
- Delivery intent: placement and ending frame.

## Model Adaptation

Use Kling 3 4K for premium product loops, Kling 3 Pro for campaign-ready social brand assets, and Veo or Sora when the asset is cinematic.

## Negative Checklist

off-brand colors, extra logos, messy composition, illegible text
