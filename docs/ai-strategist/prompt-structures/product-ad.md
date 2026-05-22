---
id: product-ad
label: Product ad
knowledge_version: 0.1.0
---

# Product Ad Prompt Structure

Source of truth: `frontend/lib/ai-strategist/prompt-structures.ts`

## Goal

Create a commercial video that keeps the product readable while adding premium motion and conversion intent.

## Required Inputs

product, target buyer, surface or environment, main benefit, output format

## Structure

- Hero product: product, material, color, scale, and readable details.
- Commercial setup: surface, props, background, light, and brand mood.
- Motion: one camera move and one product movement or reveal.
- End frame: final composition and call-to-action-safe space.

## Model Adaptation

Use Kling 3 4K for explicit final 4K detail, Kling 3 Pro or Standard for commercial product variants, and Seedance, Veo Lite or LTX when motion timing and budget matter more than product detail.

## Negative Checklist

warped product shape, unreadable labels, extra logos, cluttered background
