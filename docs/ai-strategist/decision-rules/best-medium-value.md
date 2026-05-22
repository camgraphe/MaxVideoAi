---
id: best-medium-value
label: Best / Medium / Value decision rules
knowledge_version: 0.1.0
---

# Best / Medium / Value Decision Rules

Source of truth: `frontend/lib/ai-strategist/recommendation-rules.ts`

## Purpose

`recommendModelsForBrief(brief)` returns one recommendation for each tier: best, medium, and value. It does not call a live model.

## Brief Signals

The helper can use a structured brief or plain text. Core signals are workflow, prompt structure, budget priority, speed priority, quality priority, goal text, and required traits.

## Tier Logic

- Best prioritizes maximum output quality, realism, product detail, or narrative coherence.
- Medium balances quality with iteration practicality.
- Value prioritizes cost efficiency, speed, and early creative exploration.
- Draft and storyboard briefs reinterpret Best as the best fit for fast, low-cost testing rather than the highest possible quality.
- Veo 3.1 Lite is a major Value/budget option for Veo-family realistic drafts with native audio, especially when the brief asks for a lower-cost Veo route.
- Happy Horse 1.0 is a strong candidate for compatible audio/lip-sync/spokesperson workflows, but it should not win Best automatically just because dialogue or lip-sync appears.
- Sora should only win Best when the user explicitly asks for Sora or the brief is strongly cinematic/conceptual enough to justify it.
- Premium product briefs use Kling 3 Pro as the default Best recommendation unless the user explicitly asks for 4K, ultra-high detail, final commercial delivery, large-screen use, maximum product detail, or premium export quality. In those non-4K premium product cases, Kling 3 4K should be mentioned as an upgrade path instead of the default Best pick.
- Product/object reference image-to-video keeps Seedance 2.0 viable for social-first product ads, dynamic motion, vertical content, and cost-efficient iteration when exact label or fine-text fidelity is less critical.
- Speech, dialogue, lip-sync, and spokesperson briefs can add Happy Horse 1.0 as `alsoConsider` when it is a specialized fit but not the right Best/Medium/Value pick.
- Product voiceover-only briefs without a visible talking person should not add Happy Horse as `alsoConsider`; keep those routed through Seedance, Kling, or Veo.
- Silent person or character image-to-video should not add Happy Horse as `alsoConsider` unless audio or lip-sync is requested.

## Focus Logic

- Product briefs weight product detail, social ad strength, and Kling model specialization.
- Product briefs with explicit 4K/final-export signals route Best to Kling 3 4K, Medium to Kling 3 Pro, and Value to Kling 3 Standard when supported.
- Strict product preservation briefs that emphasize exact packaging, label placement, SKU accuracy, legal copy, logo position, or fine text route Best to Kling 3 Pro and Medium to Kling 3 Standard. Seedance 2.0 can still appear as Value with a product-detail warning.
- Cinematic briefs weight realism, motion, and premium quality, with Veo 3.1 favored for realistic scenes and Veo 3.1 Lite available as the budget Veo-family Value route.
- Social briefs weight social ad score, speed, motion clarity, and variant testing.
- Character briefs weight motion, realism, identity anchors, and lip-sync/audio needs. Seedance, Veo, Kling, LTX, and Happy Horse can all be valid for dialogue; pick by workflow, reference risk, quality target, and budget rather than making Happy Horse the automatic Best route.
- Brand briefs weight product detail, premium quality, and controlled composition.
- Playful effects and transformation briefs can use Pika or Hailuo, but Pika and Hailuo rank below Kling, Veo, Seedance, and LTX for serious commercial recommendations.

## Person Reference Image-To-Video

For real person, avatar, face, spokesperson, or character-reference image-to-video briefs, Kling and LTX are safer default routes for uploaded person/character preservation. Seedance and Sora should be avoided for uploaded person or character references unless the image was generated first with Seedream/text-to-image inside the compatible workflow. Happy Horse supports image/reference/video workflows but remains limited for real-person image-to-video preservation, so it should not be the default Best route for uploaded real-person images.

## Output Contract

Each tier returns the selected model entry, a short reason for UI display, and matched signals that explain the recommendation. The output can also include `alsoConsider` for a specialized alternative such as Happy Horse 1.0 when the top-three commercial routing should stay focused on Veo, Seedance, Kling, or LTX.
